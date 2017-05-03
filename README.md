# EWD VistA Login

EWD VistA Login is a required module of EWD VistA. For installation instructions see the repository for the application core:

https://github.com/shabiel/ewd-vista

## Configuration Options
The package.json has an item called 'upper-case-vc' under ewdVista.config. This is there to accomodate uppercasing of verify code which HAS to be done on the node.js side before calling RPC XUS CVC to change the verify code. It's a configuration item to allow people using this in vxVistA or WorldVistA to turn it off as these distros support lowercase verify codes.
