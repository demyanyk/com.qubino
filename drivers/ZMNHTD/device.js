'use strict';

const constants = require('../../lib/constants');
const QubinoDevice = require('../../lib/QubinoDevice');

/**
 * Smart Meter (ZMNHTD)
 * Extended manual: http://qubino.com/download/2069/
 * Regular manual: http://qubino.com/download/1093/
 * TODO: METER_CC not available when paired secure
 * TODO: device sends reports in var not kVar (maybe also other devices)
 * TODO: fix multi channel node configuration
 */
class ZMNHTD extends QubinoDevice {

	/**
	 * Method that registers custom setting parsers.
	 */
	registerSettings() {
		super.registerSettings();
	}

	/**
	 * Method that will register capabilities of the device based on its configuration.
	 * @private
	 */
	registerCapabilities() {
		this.registerCapability(constants.capabilities.onoff, constants.commandClasses.switchBinary);
		this.registerCapability(constants.capabilities.measureVoltage, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.measureCurrent, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.measurePower, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.meterPowerImport, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.meterPowerExport, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.powerReactive, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.powerTotalReactive, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.powerTotalApparent, constants.commandClasses.meter);
		this.registerCapability(constants.capabilities.powerFactor, constants.commandClasses.meter);
	}
}

module.exports = ZMNHTD;
