const express = require('express')
const pg = require('pg')
const rateLimiter = require('./rateLimiter')

const app = express()
// configs come from standard PostgreSQL env vars
// https://www.postgresql.org/docs/9.6/static/libpq-envars.html
const pool = new pg.Pool()

const queryHandler = (req, res, next) => {
  pool.query(req.sqlQuery).then((r) => {
    return res.json(r.rows || [])
  }).catch(next)
}

app.use(rateLimiter)

app.get('/', (req, res) => {
  res.send('Welcome to EQ Works 😎')
})

app.get('/events/hourly', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, hour, events
    FROM public.hourly_events
    ORDER BY date, hour
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/events/daily', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, SUM(events) AS events
    FROM public.hourly_events
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/stats/hourly', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, hour, impressions, clicks, revenue
    FROM public.hourly_stats
    ORDER BY date, hour
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/stats/daily', (req, res, next) => {
  req.sqlQuery = `
    SELECT date,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(revenue) AS revenue
    FROM public.hourly_stats
    WHERE poi_id = 3
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/stats', (req, res, next) => {
  req.sqlQuery = `
    SELECT *
    FROM public.hourly_stats
    ORDER BY date
    LIMIT 100;
  `
  return next()
}, queryHandler)

app.get('/poi', (req, res, next) => {
  req.sqlQuery = `
    SELECT *
    FROM public.poi;
  `
  return next()
}, queryHandler)

app.get('/poi_data', (req, res, next) => {
  req.sqlQuery = `
    SELECT 
      public.poi.poi_id AS poi_id,
      SUM(DISTINCT e.events) AS events,
      SUM(DISTINCT s.impressions) AS impressions,
      SUM(DISTINCT s.clicks) AS clicks,
      SUM(DISTINCT s.revenue) AS revenue,
      public.poi.name AS name,
      public.poi.lat AS lat,
      public.poi.lon AS lon,
      e.date
    FROM public.poi
    LEFT JOIN public.hourly_events e ON e.poi_id = public.poi.poi_id
    LEFT JOIN public.hourly_stats s ON s.poi_id = public.poi.poi_id AND s.date = e.date
    GROUP BY e.date, public.poi.name, public.poi.poi_id, public.poi.lat, public.poi.lon
    LIMIT 100;
  `
  return next()
}, queryHandler)

app.get('/map_data', (req, res, next) => {
  req.sqlQuery = `
    SELECT 
      SUM(DISTINCT e.events) AS events,
      SUM(DISTINCT s.impressions) AS impressions,
      SUM(DISTINCT s.clicks) AS clicks,
      SUM(DISTINCT s.revenue) AS revenue,
      public.poi.name AS name,
      public.poi.lat AS lat,
      public.poi.lon AS lon
    FROM public.poi
    LEFT JOIN public.hourly_events e ON e.poi_id = public.poi.poi_id
    LEFT JOIN public.hourly_stats s ON s.poi_id = public.poi.poi_id AND s.date = e.date
    GROUP BY public.poi.name, public.poi.lat, public.poi.lon;
  `
  return next()
}, queryHandler)

app.get('/data/hourly', (req, res, next) => {
  req.sqlQuery = `
    SELECT *
    FROM public.hourly_events a
    LEFT JOIN public.hourly_stats b ON a.date = b.date AND a.hour = b.hour
    ORDER BY a.date
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/data/daily', (req, res, next) => {
  req.sqlQuery = `
    SELECT 
        a.date,
        SUM(DISTINCT impressions) AS impressions,
        SUM(DISTINCT clicks) AS clicks,
        SUM(DISTINCT revenue) AS revenue,
        SUM(DISTINCT events) AS events
    FROM public.hourly_events a
    LEFT JOIN public.hourly_stats b ON a.date = b.date
    GROUP BY a.date
    ORDER BY a.date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.listen(process.env.PORT || 5555, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  } else {
    console.log(`Running on ${process.env.PORT || 5555}`)
  }
})

// last resorts
process.on('uncaughtException', (err) => {
  console.log(`Caught exception: ${err}`)
  process.exit(1)
})
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit(1)
})
