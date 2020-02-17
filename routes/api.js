/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const expect = require('chai').expect;
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const StockSchema = require('../models/StockSchema.js');

mongoose // start connection
  .connect(process.env.MONGO_URI, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false })
  .then(() => console.log('DB Connected!'))
  .catch(err => {
    console.log(Error, err.message);
  });

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(function (req, res, next){

    let userIp = req.headers['x-forwarded-for'].replace(/(,.+)/g, ''); // get user ip and clean it up
    let tickers; // var to store all stock tickers from req.query.stock

    // clean up stock tickers from req.query.stock, remove whitespace, to uppercase, etc... and save to tickers
    tickers = Array.isArray(req.query.stock) ?
      req.query.stock.map(v=>v.replace(/\s+/g, '').toUpperCase()) :
      req.query.stock.replace(/\s+/g, '').toUpperCase().split(' ') ;
    
    // function to get all api stock data
    function getApiData() {
      let apiArr = [];
      
      tickers.forEach(ticker => apiArr.push(fetch(`https://repeated-alpaca.glitch.me/v1/stock/${ticker}/quote`)
        .then(data => data.json())
        .catch(err => console.log(err))
      ));
      
      return Promise.all(apiArr).catch(err => console.log(err));
    }
    
    // function for saving all stock data to database (save unique stocks and update old stocks)
    function saveNewUsers(dbData) {
      let saveArr = []; // store all mongoose promises and return in Promise.all at end of function

      tickers.forEach(val => { // for each stock in tickers var
        let testval = dbData.some(e => e.stock === val) // check if stock already in database
        let dbInstance = dbData.find(e => e.stock === val) // get info from dbData for this stock
        let ipTest = !!dbInstance ? dbInstance.ipaddress.some(e => e === userIp) : false; // check if user ip already saved for this stock

        if (testval && !ipTest && req.query.like) { // if already in database and unique ip and req.query.like
          saveArr.push(
            StockSchema.findOneAndUpdate({stock: val}, {$inc: {likes: 1}, $push: {ipaddress: userIp}})
              .exec()
          )
        } else if (!testval) { // if not in database save new instance
          if (req.query.like) { // if req.query.like save this set of data
            let newStock = new StockSchema({
              stock: val,
              likes: 1,
              ipaddress: userIp
            });
            saveArr.push(newStock.save())
          } else { // if no req.query.like save this set of data
            let newStock = new StockSchema({
              stock: val,
              likes: 0
            });
            saveArr.push(newStock.save())
          }
        }
      });
      return Promise.all(saveArr).catch(err => console.log(err));
    }

    // main program to deal with get request
    (async function init() {
      let apiData = await getApiData() // await the return of the api data
      let dbData = await StockSchema.find({'stock': {$in: tickers}}).exec() // await the return of database data
      let apiDataCheck = apiData.some(val => val === 'Unknown symbol') // check if any stock tickers are unknown
      
      if (apiDataCheck) { // if stock ticker unknown respond with error
        res.json({error: 'Unknown symbol'}); 
      } else { // if no problem with stock ticker data, save the stocks
        await saveNewUsers(dbData);// save the stocks here, await the save process before going on
        let newSaveData = await StockSchema.find({'stock': {$in: tickers}}).exec() // get updated stock data from database
        
        if (newSaveData.length === 1) { // response for one stock
          res.json({
            stockData: 
              {
                stock: newSaveData[0].stock, 
                price: apiData[0].latestPrice, 
                likes: newSaveData[0].likes
              }
          })
        } else if (newSaveData.length === 2) { // response  for two stocks
          res.json({
            stockData:
              [
                {
                  stock: newSaveData[0].stock, 
                  price: apiData[0].latestPrice, 
                  rel_likes: newSaveData[0].likes - newSaveData[1].likes
                },
                {
                  stock: newSaveData[1].stock, 
                  price: apiData[1].latestPrice, 
                  rel_likes: newSaveData[1].likes - newSaveData[0].likes
                }
              ]
          })
        }
      }
    }());
  })
};
