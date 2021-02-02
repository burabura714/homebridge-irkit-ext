var http = require('http');
var semaphore = require('await-semaphore');
var mutex = new semaphore.Mutex();

let Service, Characteristic;
var sent = Date.now() - 2000;

module.exports = homebridge => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory(
    'homebridge-irkit-mod',
    'IRKitMod',
    IRKitAccessory
  );
};

class IRKitAccessory {
  constructor(log, config, api) {
	this.log = log;
	this.config = config;

	this.irkit_host = config.irkit_host;
	this.on_form = config.on_form;
	this.off_form = config.off_form;
	this.name = config.name;
	// signal, light, tvspeaker, aircon
	this.type = config.type ? config.type : "signal";
	this.active = false;

    if (api) {
      this.api = api;
      this.api.on('didFinishLaunching', () => {
        this.log('DidFinishLaunching');
      });
    }
  }

  getServices() {
    const informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'IRKit Manufacturer')
      .setCharacteristic(Characteristic.Model, 'IRKit')
      .setCharacteristic(Characteristic.SerialNumber, 'irkit');

	let service;
	if (this.type == "signal") {
		service = new Service.Switch(this.name);
		service.getCharacteristic(Characteristic.On)
		  .on('get', this.getOnCharacteristicHandler.bind(this))
		  .on('set', this.setOnCharacteristicHandler.bind(this));
	}
    return [informationService, service];
  }

  async getOnCharacteristicHandler(callback) {
    callback(null, this.active);
  }

  async setOnCharacteristicHandler(active, callback) { 
	let release = await mutex.acquire();
	var form;
	if (active) {
		form = this.on_form;
		this.log("Setting power state to on");
	} else {
		form = this.off_form;
		this.log("Setting power state to off");
	}

	this.httpRequest(this.irkit_host, form, function (response) {
		release();
		if (response.statusCode == 200) {
			this.log('IRKit power function succeeded!');
			this.active = active;
			callback();
		} else {
			this.log(response.message);
			this.log('IRKit power function failed!');

			callback('error');
		}
	}.bind(this));
  }

  httpRequest(host, form, callback) {
	var formData = JSON.stringify(form);
	var req = http.request({
		host: this.irkit_host,
		path: "/messages",
		method: "POST",
		headers: {
			"X-Requested-With": "homebridge-irkit-mod",
			"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
			"Content-Length": formData.length
		}
	}, function (response) {
		callback(response);
	});
	req.on('error', function (response) {
		callback(response);
	});
	req.write(formData);
	this.log("request sent.");
	req.end();
  }
}

function sleep(msec) {
	return new Promise(function(resolve) {
	   setTimeout(function() {resolve()}, msec);
	})
 }
