const CC = require('currency-converter-lt');
const converter = new CC();

exports.convertCurrency = async (amount, toCurrency) => {
  return await converter
    .from('INR')
    .to(toCurrency)
    .amount(amount)
    .convert();
};
