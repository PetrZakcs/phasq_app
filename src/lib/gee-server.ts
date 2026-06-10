import ee from '@google/earthengine';

let isGeeInitialized = false;

export async function initGee(): Promise<typeof ee> {
  if (isGeeInitialized) {
    return ee;
  }

  const email = process.env.GEE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GEE_PRIVATE_KEY;
  const projectId = process.env.GEE_PROJECT_ID;

  if (!email || !privateKey) {
    throw new Error('Google Earth Engine credentials are missing in env. Make sure GEE_SERVICE_ACCOUNT_EMAIL and GEE_PRIVATE_KEY are set.');
  }

  // Parse private key if it's JSON or has escaped newlines
  let parsedKey = privateKey;
  if (privateKey.startsWith('{')) {
    try {
      const jsonKey = JSON.parse(privateKey);
      parsedKey = jsonKey.private_key;
    } catch (e) {
      // ignore
    }
  } else {
    // Replace escaped newlines
    parsedKey = privateKey.replace(/\\n/g, '\n');
  }

  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      {
        client_email: email,
        private_key: parsedKey,
      },
      () => {
        ee.initialize(
          null,
          null,
          () => {
            isGeeInitialized = true;
            if (projectId) {
              ee.data.setProject(projectId);
            }
            resolve(ee);
          },
          (err: any) => {
            reject(new Error(`GEE init failed: ${err.message || err}`));
          }
        );
      },
      (err: any) => {
        reject(new Error(`GEE auth failed: ${err.message || err}`));
      }
    );
  });
}

// Volumetric soil moisture calculations from SAR VV backscatter
// backscatter typically ranges from -20dB (extremely dry) to -5dB (waterlogged/saturated)
// We estimate: Volumetric Moisture % = (vv_db + 20) * 3
export function estimateSoilMoisture(vvDb: number): number {
  const moisture = (vvDb + 20) * 3;
  return Math.max(0, Math.min(50, Math.round(moisture * 10) / 10));
}

// Executes live Sentinel queries and returns standard dataset
export async function runGeeAnalysis(geometry: any, params: any): Promise<any> {
  const ee = await initGee();
  const eeGeom = ee.Geometry(geometry);

  const start = params.date_range?.start || '2026-05-26';
  const end = params.date_range?.end || '2026-06-09';
  const type = params.analysis_type || 'ndvi';

  if (type === 'ndvi' || type === 'ndwi') {
    // Sentinel-2 Surface Reflectance HARMONIZED Collection
    let collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(eeGeom)
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25));

    if (type === 'ndvi') {
      collection = collection.map((img: any) => {
        const ndvi = img.normalizedDifference(['B8', 'B4']).rename('ndvi');
        return img.addBands(ndvi).set('date', img.date().format('YYYY-MM-DD'));
      });
    } else {
      // NDWI = (B8 - B11) / (B8 + B11) for vegetation canopy moisture stress
      collection = collection.map((img: any) => {
        const ndwi = img.normalizedDifference(['B8', 'B11']).rename('ndwi');
        return img.addBands(ndwi).set('date', img.date().format('YYYY-MM-DD'));
      });
    }

    const sortedList = collection.sort('system:time_start');
    
    // Reduce regions to compute mean, min, max values over our geometry
    const reduced = sortedList.map((img: any) => {
      const stats = img.select(type).reduceRegion({
        reducer: ee.Reducer.mean().combine(ee.Reducer.min(), '', true).combine(ee.Reducer.max(), '', true),
        geometry: eeGeom,
        scale: 10,
        maxPixels: 1e8
      });
      return ee.Feature(null, {
        date: img.get('date'),
        mean: stats.get(`${type}_mean`),
        min: stats.get(`${type}_min`),
        max: stats.get(`${type}_max`),
      });
    });

    return new Promise((resolve, reject) => {
      reduced.getInfo((info: any, err: any) => {
        if (err) return reject(err);

        const features = info.features || [];
        const timeseries = features.map((f: any) => ({
          date: f.properties.date,
          [type]: f.properties.mean,
          min: f.properties.min,
          max: f.properties.max,
        })).filter((t: any) => t[type] !== null);

        if (timeseries.length === 0) {
          return reject(new Error('Žádné bezoblačné snímky Sentinel-2 nebyly nalezeny v zadaném období.'));
        }

        const latest = timeseries[timeseries.length - 1];
        const earliest = timeseries[0];
        const meanVal = latest[type];
        const trend = timeseries.length > 1 ? latest[type] - earliest[type] : 0;

        // Generate Map ID visual tile template
        const latestImg = sortedList.filter(ee.Filter.eq('date', latest.date)).first();
        const vizParams = type === 'ndvi'
          ? { min: 0.2, max: 0.88, palette: ['red', 'yellow', 'green'] }
          : { min: -0.05, max: 0.28, palette: ['brown', 'yellow', 'blue'] };

        const mapId = latestImg.select(type).getMap(vizParams);

        // Project ID fallback
        const projectPath = process.env.GEE_PROJECT_ID ? `projects/${process.env.GEE_PROJECT_ID}/` : '';
        const tileUrlTemplate = `https://earthengine.googleapis.com/v1/${projectPath}maps/${mapId.mapid}/tiles/{z}/{x}/{y}`;

        resolve({
          analysis_type: type,
          date_range: { start, end },
          scenes_count: timeseries.length,
          [`mean_${type}`]: meanVal,
          [`min_${type}`]: latest.min,
          [`max_${type}`]: latest.max,
          trend_14d: trend,
          alert_status: (type === 'ndvi' && meanVal < 0.4) || (type === 'ndwi' && meanVal < 0.15) ? 'DROUGHT RISK' : 'NOMINAL',
          geotiff_preview_url: tileUrlTemplate,
          timeseries,
          ai_summary: `Live Sentinel-2 optical analysis completed. Mean ${type.toUpperCase()} value is ${meanVal.toFixed(2)}. The 14-day trend is ${trend >= 0 ? '+' : ''}${trend.toFixed(2)}. Canopy health index is ${meanVal < 0.3 ? 'CRITICAL' : 'STABLE'}.`
        });
      });
    });

  } else if (type === 'radiometric' || type === 'polarimetric' || type === 'interferometric') {
    // Sentinel-1 SAR Backscatter
    const polarization = params.polarization || 'VV';
    const orbit = params.orbit_direction || 'DESCENDING';

    let collection = ee.ImageCollection('COPERNICUS/S1_GRD')
      .filterBounds(eeGeom)
      .filterDate(start, end)
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization.split('+')[0]))
      .filter(ee.Filter.eq('orbitProperties_pass', orbit));

    collection = collection.map((img: any) => {
      return img.set('date', img.date().format('YYYY-MM-DD'));
    });

    const sortedList = collection.sort('system:time_start');

    const reduced = sortedList.map((img: any) => {
      const stats = img.select(polarization.split('+')[0]).reduceRegion({
        reducer: ee.Reducer.mean().combine(ee.Reducer.min(), '', true).combine(ee.Reducer.max(), '', true).combine(ee.Reducer.stdDev(), '', true),
        geometry: eeGeom,
        scale: 20,
        maxPixels: 1e8
      });
      return ee.Feature(null, {
        date: img.get('date'),
        mean: stats.get(`${polarization.split('+')[0]}_mean`),
        min: stats.get(`${polarization.split('+')[0]}_min`),
        max: stats.get(`${polarization.split('+')[0]}_max`),
        stdDev: stats.get(`${polarization.split('+')[0]}_stdDev`),
      });
    });

    return new Promise((resolve, reject) => {
      reduced.getInfo((info: any, err: any) => {
        if (err) return reject(err);

        const features = info.features || [];
        const timeseries = features.map((f: any) => ({
          date: f.properties.date,
          vv_db: f.properties.mean,
          min: f.properties.min,
          max: f.properties.max,
          stdDev: f.properties.stdDev,
        })).filter((t: any) => t.vv_db !== null);

        if (timeseries.length === 0) {
          return reject(new Error('Žádné družicové radarové snímky Sentinel-1 nebyly nalezeny v zadaném období.'));
        }

        const latest = timeseries[timeseries.length - 1];
        const earliest = timeseries[0];
        const meanVal = latest.vv_db;
        const trend = timeseries.length > 1 ? latest.vv_db - earliest.vv_db : 0;
        const moistureEst = estimateSoilMoisture(meanVal);

        const latestImg = sortedList.filter(ee.Filter.eq('date', latest.date)).first();
        const vizParams = { min: -20, max: -5, palette: ['black', 'blue', 'white'] };
        const mapId = latestImg.select(polarization.split('+')[0]).getMap(vizParams);

        const projectPath = process.env.GEE_PROJECT_ID ? `projects/${process.env.GEE_PROJECT_ID}/` : '';
        const tileUrlTemplate = `https://earthengine.googleapis.com/v1/${projectPath}maps/${mapId.mapid}/tiles/{z}/{x}/{y}`;

        resolve({
          analysis_type: 'radiometric',
          date_range: { start, end },
          scenes_count: timeseries.length,
          mean_backscatter_vv: meanVal,
          min_backscatter_vv: latest.min,
          max_backscatter_vv: latest.max,
          std_dev_vv: latest.stdDev,
          trend_14d: trend,
          moisture_estimate_pct: moistureEst,
          drought_risk: moistureEst < 18,
          alert_message: moistureEst < 18 ? `Drought Risk: Soil backscatter power is low (${meanVal.toFixed(1)} dB). Estimated soil moisture: ${moistureEst}%.` : 'Moisture levels nominal.',
          geotiff_preview_url: tileUrlTemplate,
          timeseries,
          ai_summary: `Live Sentinel-1 radar backscatter (C-Band) analysis completed. Estimated soil moisture is ${moistureEst.toFixed(1)}% volumetric water content. Status evaluated as ${moistureEst < 18 ? 'DEFICIT (DROUGHT RISK)' : 'STABLE (NOMINAL)'}.`
        });
      });
    });
  } else {
    throw new Error(`Nepodporovaný typ GEE analýzy: ${type}`);
  }
}
