# Light Control Chataigne Module

This is a Chataigne module that creates an abstraction for DMX. You can define fixtures defintions (aka light types) and fixtures (aka lights) in JSON format. It also provides a way to group lights. Instead of addressing lights with DMX channels it then allows to address them by name.

## Fixture defintion format

You can define your own fixture defintion depending on the dmx channel layout of your lights.
Here is an example that defines a fixture definition for an ADJ Mega Tripar Profile Plus set to 10 channel mode.

```json
{
    "par": {
        "color": [1,2,3],
        "dimmer": 6,
        "uv": 4,
        "shutter": { "channel": 5, "default": 1},
        "dimmercurve": 10
    }
}
```

If you want to control the rgb channels with a color parameter, you just  use an array with the 3 channel numbers (cf. color in above example).
If you want to set a default for a channel you can provide a object with properties channel and default (cf. shutter in above example). 


## Fixture format

Based on the fixture definition you can then define your fixtures (lights). You define the type (name from fixture definition) and the DMX start address.
You can create a group of lights by using the type "group" (cf. "parall" below).

```json
{
    "par1": { "type": "par", "address": 1 },
    "par2": { "type": "par", "address": 460 },
    "parall": { "type": "group", "groupMembers": ["par1", "par2"], "features": ["color", "dimmer", "shutter", "dimmercurve"]},
}


## Naming convention

Currently fixtures and light names are only allowed to contain lower case letters and numbers, or internal lookup of containers will break.