class Req {
  constructor(socket, data, res) {
    this.socket = socket;
    this.res = res;
    console.log("in reqqqqq", data.body);
    if (data.body) this.body = data.body;
    if (socket.queryStringParameters) this.query = socket.queryStringParameters;
  }
}

class Res {
  constructor(socket, evName, io) {
    this.evName = evName;
    this.socket = socket;
    this.io = io;
    this.callback = (err, data) => {
      console.log("DTAs", err);
      err ? socket.emit("error", err) : socket.emit(evName, data);
    };
    this._headers = {};
    this._status = null;
  }

  set(k, v) {
    this._headers[k] = v;
    return this;
  }

  get(k) {
    return this._headers[k];
  }

  status(n) {
    console.log("st1", n);
    this._status = n;
    return this;
  }

  send(body) {
    const r = {
      statusCode: this._status,
      headers: this._headers,
      body: JSON.stringify(body),
    };
    if (this._status == 200) this.callback(null, r);
    else this.callback(r, null);
  }

  _resObject(body) {
    console.log("st2", this._status);
    return {
      statusCode: this._status,
      headers: this._headers,
      body: JSON.stringify(body),
    };
  }

  json(body) {
    this.set("Content-Type", "application/json");
    const r = this._resObject(body);
    if (this._status == 200) this.callback(null, r);
    else this.callback(r, null);
  }

  to(userId) {
    this.callback = (err, data) => {
      console.log("DTAs", err);
      err
        ? this.io.to(userId).emit("error", err)
        : this.io.to(userId).emit(this.evName, data);
    };
    return this;
  }

  all() {
    this.callback = (err, data) => {
      console.log("err", err);
      err ? this.io.emit("error", err) : this.io.emit(this.evName, data);
    };
    return this;
  }

  error(body) {
    this._status = 500;
    this.set("Content-Type", "application/json");
    const r = this._resObject(body);
    if (this._status == 200) this.callback(null, r);
    else this.callback(r, null);
  }
}
module.exports = { Req, Res };
