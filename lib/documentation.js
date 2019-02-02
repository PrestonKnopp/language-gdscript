module.exports = {
  _data: null,
  _path: '../data/documentation.json',

  load() {
    this._data = require(this._path)
  },

  get data() {
    if (this._data === null) {
      this.load()
    }
    return this._data
  }
}
