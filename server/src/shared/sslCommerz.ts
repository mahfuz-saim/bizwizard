const SSLCommerzPayment = require('sslcommerz-lts');
import config from '../config/';

//TODO: change is_live based on node environment
const is_live = config.env === 'production' ? true : false; //true for live, false for sandbox

export const sslcz = new SSLCommerzPayment(
    config.ssl.store_id,
    config.ssl.store_passwd,
    is_live,
);
