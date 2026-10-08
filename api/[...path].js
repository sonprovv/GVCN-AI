'use strict';
const { routeApi } = require('../backend/routes/api');

module.exports = async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const url = new URL(req.url, `${proto}://${host}`);
  await routeApi(req, res, url);
};
