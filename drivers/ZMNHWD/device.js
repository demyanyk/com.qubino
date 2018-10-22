'use strict';

const util = require('homey-meshdriver').Util;
const constants = require('../../lib/constants');
const QubinoDimDevice = require('../../lib/QubinoDimDevice');

const FACTORY_DEFAULT_COLOR_DURATION = 255;

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

		this.registerCapability('onoff', 'SWITCH_MULTILEVEL');
		this.registerCapability('dim', 'SWITCH_MULTILEVEL');
		let debounceColorMode;

		this.registerMultipleCapabilityListener(['light_hue', 'light_saturation'], async (values, options) => {
			let hue;
			let saturation;

			typeof values.light_hue === 'number' ? hue = values.light_hue : hue = this.getCapabilityValue('light_hue');
			typeof values.light_saturation === 'number' ? saturation = values.light_saturation : saturation = this.getCapabilityValue('light_saturation');
			const value = 1; // Brightness value is not determined in SWITCH_COLOR but with SWITCH_MULTILEVEL, changing this throws the dim value vs reallife brightness out of sync

			const rgb = util.convertHSVToRGB({ hue, saturation, value });

			debounceColorMode = setTimeout(() => {
				debounceColorMode = false;
			}, 200);

			return await this._sendColors({
				warm: 0,
				cold: 0,
				red: rgb.red,
				green: rgb.green,
				blue: rgb.blue,
				duration: options.duration || FACTORY_DEFAULT_COLOR_DURATION,
			});
		});

		this.registerCapabilityListener(['light_temperature'], async (value, options) => {
			const warm = Math.floor(value * 255);
			const cold = Math.floor((1 - value) * 255);

			debounceColorMode = setTimeout(() => {
				debounceColorMode = false;
			}, 200);

			return await this._sendColors({
				warm,
				cold,
				red: 0,
				green: 0,
				blue: 0,
				duration: options.duration || FACTORY_DEFAULT_COLOR_DURATION,
			});
		});

		this.registerCapability('light_mode', 'SWITCH_COLOR', {
			set: 'SWITCH_COLOR_SET',
			setParser: (value, options) => {

				// set light_mode is always triggered with the set color/temperature flow cards, timeout is needed because of homey's async nature surpassing the debounce
				setTimeout(async () => {
					if (debounceColorMode) {
						clearTimeout(debounceColorMode);
						debounceColorMode = false;
						return this.setCapabilityValue('light_mode', value);
					}

					if (value === 'color') {
						const hue = this.getCapabilityValue('light_hue') || 1;
						const saturation = this.getCapabilityValue('light_saturation') || 1;
						const _value = 1; // Bightness value is not determined in SWITCH_COLOR but with SWITCH_MULTILEVEL, changing this throws the dim value vs reallife brightness out of sync

						const rgb = util.convertHSVToRGB({ hue, saturation, _value });

						return await this._sendColors({
							warm: 0,
							cold: 0,
							red: rgb.red,
							green: rgb.green,
							blue: rgb.blue,
							duration: options.duration || FACTORY_DEFAULT_COLOR_DURATION,
						});

					} else if (value === 'temperature') {
						const temperature = this.getCapabilityValue('light_temperature') || 1;
						const warm = temperature * 255;
						const cold = (1 - temperature) * 255;

						return await this._sendColors({
							warm,
							cold,
							red: 0,
							green: 0,
							blue: 0,
							duration: options.duration || FACTORY_DEFAULT_COLOR_DURATION,
						});
					}
				}, 50);
			},
		});

		// Getting all color values during boot
		const commandClassColorSwitch = this.getCommandClass('SWITCH_COLOR');

		if (!(commandClassColorSwitch instanceof Error) && typeof commandClassColorSwitch.SWITCH_COLOR_GET === 'function') {

			// Timeout mandatory for stability, often fails getting 1 (or more) value without it
			setTimeout(() => {
				// Warm White
				const WarmWhite = new Promise((resolve, reject) => {
					commandClassColorSwitch.SWITCH_COLOR_GET({
						'Color Component ID': 0,
					})
						.catch(error => {
							this.error(error);
							return resolve(0);
						})
						.then(result => resolve((result && typeof result.Value === 'number') ? result.Value : 0));
				});

				// Cold White
				const ColdWhite = new Promise((resolve, reject) => {
					commandClassColorSwitch.SWITCH_COLOR_GET({
						'Color Component ID': 1,
					})
						.catch(error => {
							this.error(error);
							return resolve(0);
						})
						.then(result => resolve((result && typeof result.Value === 'number') ? result.Value : 0));
				});

				// Red
				const Red = new Promise((resolve, reject) => {
					commandClassColorSwitch.SWITCH_COLOR_GET({
						'Color Component ID': 2,
					})
						.catch(error => {
							this.error(error);
							return resolve(0);
						})
						.then(result => resolve((result && typeof result.Value === 'number') ? result.Value : 0));
				});

				// Green
				const Green = new Promise((resolve, reject) => {
					commandClassColorSwitch.SWITCH_COLOR_GET({
						'Color Component ID': 3,
					})
						.catch(error => {
							this.error(error);
							return resolve(0);
						})
						.then(result => resolve((result && typeof result.Value === 'number') ? result.Value : 0));
				});

				// Blue
				const Blue = new Promise((resolve, reject) => {
					commandClassColorSwitch.SWITCH_COLOR_GET({
						'Color Component ID': 4,
					})
						.catch(error => {
							this.error(error);
							return resolve(0);
						})
						.then(result => resolve((result && typeof result.Value === 'number') ? result.Value : 0));
				});

				// Wait for all color values to arrive
				Promise.all([WarmWhite, ColdWhite, Red, Green, Blue])
					.then(result => {
						if (result[0] === 0 && result[1] === 0) {
							const hsv = util.convertRGBToHSV({
								red: result[2],
								green: result[3],
								blue: result[4],
							});

							this.setCapabilityValue('light_mode', 'color');
							this.setCapabilityValue('light_hue', hsv.hue);
							this.setCapabilityValue('light_saturation', hsv.saturation);
						} else {
							const temperature = Math.round(result[0] / 255 * 100) / 100;

							this.setCapabilityValue('light_mode', 'temperature');
							this.setCapabilityValue('light_temperature', temperature);
						}
					});
			}, 500);
		}
	}

	async _sendColors({ warm, cold, red, green, blue, duration }) {
		const commandClassSwitchColorVersion = this.getCommandClass('SWITCH_COLOR').version || 1;

		let setCommand = {
			Properties1: {
				'Color Component Count': 5,
			},
			vg1: [
				{
					'Color Component ID': 0,
					Value: Math.round(warm),
				},
				{
					'Color Component ID': 1,
					Value: Math.round(cold),
				},
				{
					'Color Component ID': 2,
					Value: Math.round(red),
				},
				{
					'Color Component ID': 3,
					Value: Math.round(green),
				},
				{
					'Color Component ID': 4,
					Value: Math.round(blue),
				},
			],
		};

		if (typeof duration === 'number' && commandClassSwitchColorVersion > 1) {
			setCommand.duration = util.calculateZwaveDimDuration(duration) || FACTORY_DEFAULT_COLOR_DURATION;
		}

		// Fix broken CC_SWITCH_COLOR_V2 parser
		if (commandClassSwitchColorVersion === 2) {
			const commandBuffer = new Buffer([setCommand.Properties1['Color Component Count'], 0, setCommand.vg1[0].Value, 1, setCommand.vg1[1].Value, 2, setCommand.vg1[2].Value, 3, setCommand.vg1[3].Value, 4, setCommand.vg1[4].Value, setCommand.duration]);
			setCommand = commandBuffer;
		}

		await this.node.CommandClass.COMMAND_CLASS_SWITCH_COLOR.SWITCH_COLOR_SET(setCommand)
			.catch(error => Promise.reject(error))
			.then(result => {
				if (result !== 'TRANSMIT_COMPLETE_OK') return Promise.reject(result);

				return Promise.resolve(true);
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
