var parameterPath = local.parameters;
var fixtureDefinitionParameter = parameterPath.setup.fixtureDefinition;
var fixturesParameter = parameterPath.setup.fixtures;
var fixtureDefinition;
var fixtures;
var lightsContainer;
var correctionsParameter = parameterPath.setup.corrections;
var reloadCorrections = parameterPath.setup.reloadCorrections;
var corrections;
var panTiltParameters = [];
var loadFixturesParameter = parameterPath.setup.loadFixtures;
var clearDMXParameter = parameterPath.setup.clearDMX;


function init() {
	//clearDefaultValues();
	loadFixtures();
	loadCorrections();
}

function loadCorrections() {
	var fileName = correctionsParameter.get();

	if (util.fileExists(fileName)) {
		corrections = util.readFile(fileName, true);
		resendPanAndTilt();
	} else {
		script.logWarning("Correction file not found");
	}
}

function resendPanAndTilt() {
	for (var i = 0; i < panTiltParameters.length; i++) {
		var o = panTiltParameters[i];
		var value = o.parameter.get();
		value = getCorrectedPanTiltValue(o.light, o.channel, value);
		value = convertFloatToDMX(value);
		var dmxChannel = getDMXChannel(o.light, o.channel, false);

		local.send(dmxChannel, value);
	}
}

function loadFixtures() {
	var fd = util.readFile(fixtureDefinitionParameter.get(), true);
	fixtureDefinition = fd.defintions;
	fixtures = util.readFile(fixturesParameter.get(), true);
	
	if (fixtureDefinition == undefined || fixtures == undefined) {
		script.logError("Could not read fixture definition and fixtures JSON files.");
	} else {
		panTiltParameters = [];
		createFixtureParameters();
		script.log("Loaded Fixtures");
		
		parameterPath = local.getChild("Parameters");
	}
}


function createFixtureParameters() {
	var fixtureKeys = util.getObjectProperties(fixtures); 
	
	parameterPath.removeContainer("Lights");
	lightsContainer = parameterPath.addContainer("Lights");
	lightsContainer.setCollapsed(true);

	parameterPath.removeContainer("Groups");
	groupsContainer = parameterPath.addContainer("Groups");
	groupsContainer.setCollapsed(true);
	
	for (var i = 0; i < fixtureKeys.length; i++) {
		var key = fixtureKeys[i];
		var fixture = fixtures[key];
		var type = fixture.type;
		var isGroup = (type == "group");
		
		if (isGroup) {
			var container = groupsContainer.addContainer(key);
			container.setCollapsed(true);
			createGroupChannelParameters(key, container);
		} else {
			var container = lightsContainer.addContainer(key);
			container.setCollapsed(true);
			createLightChannelParameters(key, type, container);
		}
	}
}


function createLightChannelParameters(name, type, container) {
	var fd = util.getObjectProperties(fixtureDefinition[type]);
	var p;
	
	for (var i = 0; i < fd.length; i++) {
		var channelName = fd[i];  // channel name
		var channelValue = fixtureDefinition[type][channelName]; // channel value
		var channelUIName = capitalizeFirstLetter(channelName);
		var defaultValue = channelValue.default;
		
		if (channelName == "color" || channelValue.length == 3) {
			p = container.addColorParameter(channelUIName, channelName + " of " + name,[0,0,0,1]);
			p.setAttribute("alwaysNotify", true);
		} else {
			p = container.addFloatParameter(channelUIName, channelName + " of " + name,0,0,1);
			p.setAttribute("alwaysNotify", true);
			
			if (defaultValue) {
				p.set(channelValue.default); // needed to trigger parameter change event
			}

			if (channelName == "pan" || channelName == "tilt") {
				panTiltParameters.push({ "light": name, "channel": channelName, "parameter": p });
			}
		}
	}
}


function createGroupChannelParameters(name, container) {
	var group = fixtures[name];
	var features = group.features;
	var p;

	if (features) {
		var p;
		
		for (var i = 0; i < features.length; i++) {
			var channelName = features[i];  // channel name
			var channelUIName = capitalizeFirstLetter(channelName);
		
			if (channelName == "color" || channelValue.length == 3) {
				p = container.addColorParameter(channelUIName, channelName + " of " + name,[0,0,0,1]);
				p.setAttribute("alwaysNotify", true);
			} else {
				p = container.addFloatParameter(channelUIName, channelName + " of " + name,0,0,1);
				p.setAttribute("alwaysNotify", true);
			}
		}	
		
	} else {
		var dimmer = definition.dimmer;
		var color = [definition.color1, definition.color2, definition.color3];
		
		p = container.addFloatParameter("Dimmer","Dimmer of " + name,0,0,1);
		p.setAttribute("alwaysNotify", true);
		p = container.addColorParameter("Color","Color of " + name,[0,0,0,1]);
		p.setAttribute("alwaysNotify", true);
		p = container.addFloatParameter("Shutter","Shutter of " + name,0,0,1);
		p.setAttribute("alwaysNotify", true);
	}
}


function moduleParameterChanged(param) {
	if (param.is(local.outActivity)) return;
	
	if (param.is(loadFixturesParameter)) {
		loadFixtures();
	} else if (param.is(clearDMXParameter)) {
		clearDMX();
	} else if (param.is(reloadCorrections)) {
		loadCorrections();
	} else {
		lightOrGroupChanged(param);
	}
}


function lightOrGroupChanged (param) { 
	if (param.is(local.outActivity)) return;
	
	var isGroup = param.getParent().getParent().name == "groups";
	var isLight = param.getParent().getParent().name == "lights";
	var light = param.getParent().name;
	var channel = param.name;

	if (channel == "color") {
		if (isLight) {
			// output color to DMX
			var c = convertColorToDMX(param.get());
			
			var dmxChannel = getDMXChannel(light, "color", isGroup);
			
			local.send(dmxChannel[0], c[0]);
			local.send(dmxChannel[1], c[1]);
			local.send(dmxChannel[2], c[2]);
		} else if (isGroup) {
			// set color to groupMembers parameters
			var lights = fixtures[light].groupMembers;
			
			for (var i = 0; i < lights.length; i++) {
				var parameter = getParameter(lights[i], "color");
				var c = param.get();
				
				parameter.set(c);  
			}
		}
		
	} else {
		if (isLight) {
			// output to DMX
			var value = param.get();
			value = getCorrectedPanTiltValue(light, channel, value);
			value = convertFloatToDMX(value);
			var dmxChannel = getDMXChannel(light, channel, isGroup);
			local.send(dmxChannel, value);
		} else if (isGroup) {
			// set groupMembers parameters
			var lights = fixtures[light].groupMembers;
			
			for (var i = 0; i < lights.length; i++) {
				var parameter = getParameter(lights[i], channel);
				parameter.set(param.get());
			}
		}
	}
}

function getCorrectedPanTiltValue(light, channel, value) {
	if (channel == "pan") {
		var c = corrections[light].panCorrection;
		var panReversal = corrections[light].panReverse;

		value = (panReversal) ? 1-value : value;
		value = value + c;
	} else if (channel == "tilt") {
		var c = corrections[light].tiltCorrection;
		var tiltReversal = corrections[light].tiltReverse;
		value = (tiltReversal) ? 1-value : value;
		value = value + c;
	}  else if (channel == "zoom") {
		var zoomReversal = corrections[light].zoomReverse;
		value = (zoomReversal) ? 1-value : value;
	} 

	return value;
}

function getDMXChannel (light, channel, isGroup) {
	var fixture = fixtures[light];
	var type = fixture.type;
	var startAddress = fixture.address;
	var channelAddress = fixtureDefinition[type][channel];
	channelAddress = (channelAddress.channel) ? channelAddress.channel : channelAddress;
	
	if (channelAddress.length == 3) {
		var colorChannel1 = startAddress + channelAddress[0] - 1;
		var colorChannel2 = startAddress + channelAddress[1] - 1;
		var colorChannel3 = startAddress + channelAddress[2] - 1;
		
		dmxAddress = [colorChannel1,colorChannel2,colorChannel3];
	} else {
		var dmxAddress = startAddress + channelAddress - 1;
	}
	
	return dmxAddress;
}


function clearDefaultValues() {
	for (var i = 1; i <= 512; i++) {
		local.values.removeParameter("channel" + i);
	}
}

////////////////////////
//Commands callbacks
////////////////////////

function setColor (light, color) {
	var channel = "color";

	if (light != "") {
		var parameter = getParameter(light, channel);

		if (parameter != undefined) {
			parameter.set(color);
		} else {
			script.logError("Error: Trying to set " + channel + " for " + light + ", but could not lookup light container. Please check name of light exists in your fixtures json.");	
		}	
	}
}

function setColorChannel (light, colorIndex, value) {
	var channel = "color";

	if (light != "") {
		var parameter = getParameter(light, channel);

		if (parameter != undefined) {
			var color = parameter.get();
			color[colorIndex] = value;
			parameter.set(color);
		} else {
			script.logError("Error: Trying to set " + channel + " for " + light + ", but could not lookup light container. Please check name of light exists in your fixtures json.");	
		}	
	}	
}

function setSimpleParameter (light, channel, value) {
	if (light != "" && channel != "") {
		var parameter = getParameter(light, channel);
		
		if (parameter != undefined) {
			parameter.set(value);
		} else {
			script.logError("Error: Trying to set " + channel + " for " + light + ", but could not lookup light container. Please check name of light exists in your fixtures json.");	
		}
	}
}

function setDimmer (light, value) {
	setSimpleParameter(light, "dimmer", value);
}

function setShutter (light, value) {
	setSimpleParameter(light, "shutter", value);
}


////////////////////////
// Helpers
////////////////////////

function convertFloatToDMX(value) {
	value = parseInt(value * 255);
	value = (value > 255) ? 255 : value;
	value = (value < 0) ? 0 : value;
	return value;
}

function convertColorToDMX(c) {
	return [convertFloatToDMX(c[0]), convertFloatToDMX(c[1]), convertFloatToDMX(c[2])]
}

function getParameter(light, channel) {
	pathName = getPathname(light);
	var type = fixtures[light].type;
	
	if (type == "group") {
		return parameterPath.groups[pathName][channel];
	} else {
		return parameterPath.lights[pathName][channel];
	}
}

function getPathname(path) {
	return path.toLowerCase().replace(" ", "");
}

function clearDMX() {
	var channels = [];
	
	for(var i=0; i < 512; i++) {
		channels.push(0);
	}
	
	local.send(1, channels);
	loadFixtures();
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.substring(1,string.length);
}