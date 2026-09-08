'use strict';

const { Temporal } = require('@js-temporal/polyfill');

const MALAYSIA_TIME_ZONE = 'Asia/Kuala_Lumpur';

function nowMalaysia() {
  return Temporal.Now.zonedDateTimeISO(MALAYSIA_TIME_ZONE).toString();
}

module.exports = {
  MALAYSIA_TIME_ZONE,
  nowMalaysia
};