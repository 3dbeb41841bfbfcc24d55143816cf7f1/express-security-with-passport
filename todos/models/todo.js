var mongoose = require('mongoose');

var TodoSchema = new mongoose.Schema({
  title:         { type: String,  required: true },
  completed:     { type: Boolean, required: true }
  },
  { timestamps: true }  // createdAt, updatedAt
);

function date2String(date) {
  var options = {
    weekday: 'long', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

TodoSchema.methods.getCreatedAt = function() {
  return date2String(this.createdAt);
};

TodoSchema.methods.getUpdatedAt = function() {
  return date2String(this.updatedAt);
};

module.exports = mongoose.model('Todo', TodoSchema);
