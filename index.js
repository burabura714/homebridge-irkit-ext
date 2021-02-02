var http = require('http');
const fs = require('fs');
var semaphore = require('await-semaphore');
var mutex = new semaphore.Mutex();

let Service, Characteristic;

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
	this.name = config.name;
	// signal, light, tvspeaker, aircon
	this.type = config.type ? config.type : "signal";

	// signal common
	this.power = false;
	this.on_form = config.on_form;
	this.off_form = config.off_form;

	// tvspeaker
	this.mute_form = config.mute_form;
	this.mute_status = false;

	// aircon
	this.active = Characteristic.Active.INACTIVE;
	this.aircon_state = Characteristic.CurrentHeaterCoolerState.INACTIVE;
	this.aircon_target_state = Characteristic.TargetHeaterCoolerState.HEAT;
	this.heater_form = config.heater_form;
	this.cooler_form = config.cooler_form;
	this.auto_form = config.auto_form;
	this.temperature = 20;
	this.heat_target = config.heat_target;
	this.cool_target = config.cool_target;

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
	} else if (this.type == "light") {
		service = new Service.Lightbulb(this.name);
		service.getCharacteristic(Characteristic.On)
		.on('get', this.getOnCharacteristicHandler.bind(this))
		.on('set', this.setOnCharacteristicHandler.bind(this));
	} else if (this.type == "tvspeaker") {
		service = new Service.TelevisionSpeaker(this.name);
		service.getCharacteristic(Characteristic.Mute)
		  .on('get', this.handleMuteGet.bind(this))
		  .on('set', this.handleMuteSet.bind(this));
	} else if (this.type == "aircon") {
		service = new Service.HeaterCooler(this.name);
		service.getCharacteristic(Characteristic.Active)
		  .on('get', this.handleActiveGet.bind(this))
		  .on('set', this.handleActiveSet.bind(this));

		service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
		  .on('get', this.handleCurrentHeaterCoolerStateGet.bind(this));

		service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
		  .on('get', this.handleTargetHeaterCoolerStateGet.bind(this))
		  .on('set', this.handleTargetHeaterCoolerStateSet.bind(this));

		service.getCharacteristic(Characteristic.CurrentTemperature)
		  .on('get', this.handleCurrentTemperatureGet.bind(this));

		service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
		  .on('get', this.handleCoolingThresholdTemperatureGet.bind(this));
		
		service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
		  .on('get', this.handleHeatingThresholdTemperatureGet.bind(this));
	} else {
		this.log(`type ${this.type} is not supported.`);
	}
    return [informationService, service];
  }
  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  handleActiveGet(callback) {
    this.log.debug('Triggered GET Active');

    callback(null, this.active);
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  handleActiveSet(value, callback) {
	this.log.debug('Triggered SET Active:' + value);
	
	var form;
	var state_to_change;
	if (value) {
		if (this.aircon_target_state == Characteristic.TargetHeaterCoolerState.HEAT) {
			if (this.aircon_state == Characteristic.CurrentHeaterCoolerState.HEATING) {
				callback(null);
				return;
			}
			form = this.heater_form;
			state_to_change = Characteristic.CurrentHeaterCoolerState.HEATING;
			this.log("Setting state to heat.");
		} else if (this.aircon_target_state == Characteristic.TargetHeaterCoolerState.COOL) {
			if (this.aircon_state == Characteristic.CurrentHeaterCoolerState.COOLING) {
				callback(null);
				return;
			}
			form = this.heater_form;
			state_to_change = Characteristic.CurrentHeaterCoolerState.COOLING;
			this.log("Setting state to cool.");
		} else if (this.aircon_target_state == Characteristic.TargetHeaterCoolerState.AUTO) {
			form = this.auto_form;
			state_to_change = Characteristic.CurrentHeaterCoolerState.IDLE;
			this.log("Setting state to auto.");
		}
	} else {
		form = this.off_form;
		this.log("Setting power state to off");
	}

	this.httpRequestSerialized(this.irkit_host, form, callback, () => {this.active = value; this.aircon_state = state_to_change});
  }

  /**
   * Handle requests to get the current value of the "Current Heater Cooler State" characteristic
   */
  handleCurrentHeaterCoolerStateGet(callback) {
    this.log.debug('Triggered GET CurrentHeaterCoolerState');

    callback(null, this.CurrentHeaterCoolerState);
  }

  /**
   * Handle requests to get the current value of the "Target Heater Cooler State" characteristic
   */
  handleTargetHeaterCoolerStateGet(callback) {
    this.log.debug('Triggered GET TargetHeaterCoolerState');

    callback(null, this.aircon_target_state);
  }

  /**
   * Handle requests to set the "Target Heater Cooler State" characteristic
   */
  handleTargetHeaterCoolerStateSet(value, callback) {
    this.log.debug('Triggered SET TargetHeaterCoolerState:' + value);
	this.aircon_target_state = value;
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(callback) {
    this.log.debug('Triggered GET CurrentTemperature');

	if (this.config.temperature_file) {
		this.temperature = fs.readFileSync(this.config.temperature_file);
	}
	
    callback(null, this.temperature);
  }

  handleCoolingThresholdTemperatureGet(callback) {
    this.log.debug('Triggered GET CoolingThresholdTemperature');

    callback(null, this.cool_target);
  }

  handleHeatingThresholdTemperatureGet(callback) {
    this.log.debug('Triggered GET HeatingThresholdTemperature');

    callback(null, this.heat_target);
  }

  /**
   * Handle requests to get the current value of the "Mute" characteristic
   */
  handleMuteGet(callback) {
    this.log.debug('Triggered GET Mute');

    callback(null, this.mute_status);
  }

  /**
   * Handle requests to set the "Mute" characteristic
   */
  handleMuteSet(state, callback) {
    this.log.debug('Triggered SET Mute:' + state);
	this.httpRequestSerialized(this.irkit_host, this.mute_form);
	this.mute_status = state;
    callback(null);
  }

  async getOnCharacteristicHandler(callback) {
    callback(null, this.power);
  }

  async setOnCharacteristicHandler(power, callback) { 
	var form;
	if (power) {
		form = this.on_form;
		this.log("Setting power state to on");
	} else {
		form = this.off_form;
		this.log("Setting power state to off");
	}

	this.httpRequestSerialized(this.irkit_host, form, callback, () => {this.power = power});
  }

  async httpRequestSerialized(host, form, callback, statehandler) {
	let release = await mutex.acquire();
	this.httpRequest(this.irkit_host, form, function (response) {
		release();
		if (response.statusCode == 200) {
			this.log('IRKit power function succeeded!');
			statehandler();
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
