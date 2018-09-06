'use strict';

const util = require('homey-meshdriver').Util;
const constants = require('../../lib/constants');
const QubinoDimDevice = require('../../lib/QubinoDimDevice');

/**
 * Flush RGBW Dimmer (ZMNHWD)
 * Extended manual: http://qubino.com/download/2063/
 * Regular manual: http://qubino.com/download/1537/
 *
 * TODO: test logic
 * TODO: test autoSceneModeTransitionDuration and autoSceneModeTransitionDurationUnit
 * TODO: 4-dimmers mode is not implementable since the mobile components can not change dynamically
 */
class ZMNHWD extends QubinoDimDevice {

	/**
	 * Method that will register capabilities of the device based on its configuration.
	 * @private
	 */
	registerCapabilities() {
		this.registerCapability(constants.capabilities.onoff, constants.commandClasses.switchBinary);
		this.registerCapability(constants.capabilities.dim, constants.commandClasses.switchMultilevel);
		this.registerMultipleCapabilityListener([constants.capabilities.lightHue, constants.capabilities.lightSaturation, constants.capabilities.lightTemperature, constants.capabilities.lightMode], (valueObj, optsObj) => {
			this.log('valueObj', valueObj);
			this.log('optsObj', optsObj);

			const dim = this.getCapabilityValue(constants.capabilities.dim);
			const lightHue = typeof valueObj.light_hue === 'number' ? valueObj.light_hue : this.getCapabilityValue('light_hue');
			const lightSaturation = typeof valueObj.light_saturation === 'number' ? valueObj.light_saturation : this.getCapabilityValue('light_saturation');
			const lightTemperature = typeof valueObj.light_temperature === 'number' ? valueObj.light_temperature : this.getCapabilityValue('light_temperature');
			const lightMode = typeof valueObj.light_mode === 'number' ? valueObj.light_mode : this.getCapabilityValue('light_mode');

			// Check if one of the capability has a duration property and use it
			let duration = 255;
			for (const capability of optsObj) {
				if (optsObj[capability].hasOwnProperty('duration')) {
					duration = util.calculateZwaveDimDuration(optsObj[capability].duration);
				}
			}

			// Create RGB object from available HSV values
			let { red = 0, green = 0, blue = 0 } = util.convertHSVToRGB({
				hue: lightHue,
				saturation: lightSaturation,
				value: dim,
			});

			// If lightMode is not color reset color values
			if (lightMode !== 'color') {
				red = 0;
				green = 0;
				blue = 0;
			}

			// If lightMode is temperature or unknown set ww/cw value, else if lightMode is color reset ww/cw
			const ww = (lightTemperature >= 0.5 && lightMode !== 'color') ? util.mapValueRange(0.5, 1, 10, 255, lightTemperature) : 0;
			const cw = (lightTemperature < 0.5 && lightMode !== 'color') ? util.mapValueRange(0, 0.5, 255, 10, lightTemperature) : 0;

			// Set switch color set command
			return this._sendColors({
				red: Math.round(red * dim),
				green: Math.round(green * dim),
				blue: Math.round(blue * dim),
				warm: Math.round(ww * dim),
				cold: Math.round(cw * dim),
				duration,
			});
		}, 500);
	}

	async _sendColors({ red, green, blue, warm, cold, duration }) {
		return await this.node.CommandClass.COMMAND_CLASS_SWITCH_COLOR.SWITCH_COLOR_SET({
			Properties1: {
				'Color Component Count': 5,
			},
			Duration: duration,
			vg1: [
				{
					'Color Component ID': 0,
					Value: warm,
				},
				{
					'Color Component ID': 1,
					Value: cold,
				},
				{
					'Color Component ID': 2,
					Value: red,
				},
				{
					'Color Component ID': 3,
					Value: green,
				},
				{
					'Color Component ID': 4,
					Value: blue,
				},
			],
		});
	}

	/**
	 * Override onSettings to handle combined z-wave settings.
	 * @param oldSettings
	 * @param newSettings
	 * @param changedKeysArr
	 * @returns {Promise<T>}
	 */
	async onSettings(oldSettings, newSettings, changedKeysArr) {

		// Get updated duration unit
		let autoSceneModeTransitionDurationUnit = oldSettings[constants.settings.autoSceneModeTransitionDurationUnit];
		if (changedKeysArr.includes(constants.settings.autoSceneModeTransitionDurationUnit)) {
			autoSceneModeTransitionDurationUnit = newSettings[constants.settings.autoSceneModeTransitionDurationUnit];

			// If unit changed make sure duration is also added as changed
			changedKeysArr.push(constants.settings.autoSceneModeTransitionDuration);
		}

		// Get updated transition duration value
		let autoSceneModeTransitionDuration = oldSettings[constants.settings.autoSceneModeTransitionDuration];
		if (changedKeysArr.includes(constants.settings.autoSceneModeTransitionDuration)) {
			autoSceneModeTransitionDuration = newSettings[constants.settings.autoSceneModeTransitionDuration];
		}

		// Add 1000 if unit is minutes
		if (autoSceneModeTransitionDurationUnit === 'min') {
			newSettings[constants.settings.autoSceneModeTransitionDuration] = autoSceneModeTransitionDuration + 1000;
		}

		return super.onSettings(oldSettings, newSettings, changedKeysArr);
	}
}

module.exports = ZMNHWD;
