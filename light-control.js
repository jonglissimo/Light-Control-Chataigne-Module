var parameterPath = local.parameters;
var valuesPath = local.values;
var fixtureDefinitionParameter = parameterPath.setup.fixtureDefinition;
var fixturesParameter = parameterPath.setup.fixtures;
var fixtureDefinition;
var fixtures;
var lightsContainer;
var loadFixturesParameter = parameterPath.setup.loadFixtures;
var clearDMXParameter = parameterPath.setup.clearDMX;

function init() {
	clearDefaultValues();
	loadFixtures();
}

function loadFixtures() {
	var fd = util.readFile(fixtureDefinitionParameter.get(), true);
	fixtureDefinition = fd.defintions;
	fixtures = util.readFile(fixturesParameter.get(), true);
	
	createFixtureParameters();
	script.log("Loaded Fixtures");
	
	parameterPath = local.getChild("Parameters");
	valuesPath = local.getChild("Values");
}


function createFixtureParameters() {
	var fixtureKeys = util.getObjectProperties(fixtures); 
	
	valuesPath.removeContainer("Lights");
	lightsContainer = valuesPath.addContainer("Lights");
	valuesPath.removeContainer("Groups");
	groupsContainer = valuesPath.addContainer("Groups");
	
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
		
				if (defaultValue) {
					p.set(channelValue.default); // needed to trigger parameter change event
				}
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
	}
}


function moduleValueChanged (param) { 
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
			var maxOfFeature = fixtureFeatures[channel].maxOutput;
			
			var value = convertFloatToDMX(param.get(), maxOfFeature);
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
	return parseInt(value * 255);
}

function convertColorToDMX(c) {
	return [convertFloatToDMX(c[0]), convertFloatToDMX(c[1]), convertFloatToDMX(c[2])]
}

function getParameter(light, channel) {
	pathName = getPathname(light);
	var type = fixtures[light].type;
	
	if (type == "group") {
		return valuesPath.groups[pathName][channel];
	} else {
		return valuesPath.lights[pathName][channel];
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