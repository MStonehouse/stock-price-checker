const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
const BookSchema = new Schema({
  title: {type: String, required: true, trim: true},
  comments: [{body: String}],
},{
  timestamps: {createdAt: 'created_on', updatedAt: 'updated_on'}
});
*/


const StockSchema = new Schema({
  stock: {type: String, required: true, trim: true},
  likes: {type: Number, default: 0},
  ipaddress: [{type: String, unique: true}],
},{
  timestamps: {createdAt: 'created_on', updatedAt: 'updated_on'}
});

module.exports = mongoose.model('StockSchema', StockSchema);