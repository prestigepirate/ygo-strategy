// Baked-in editor-placed objects per map ID.
// These render in both play mode and edit mode.
// Use the "Export Objects to Clipboard" button in the editor
// to dump localStorage objects, then paste them here.

const MAP_OBJECTS = {
  "ashen-wastes": [{"type":"asset","assetId":"blue-eyes","position":[4.2,0.81,7.1],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-1"},{"type":"asset","assetId":"blue-eyes","position":[4.8,0.81,7.1],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-2"},{"type":"asset","assetId":"blue-eyes","position":[11.7,0.81,-4.4],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-4"},{"type":"hex","terrain":"plains","height":0.5,"position":[8.9,0.81,-2.4],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-5"},{"type":"hex","terrain":"plains","height":0.5,"position":[3.7,0.81,-8.5],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-6"},{"type":"hex","terrain":"plains","height":0.5,"position":[2.2,0.81,-10.8],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-7"},{"type":"hex","terrain":"plains","height":0.5,"position":[-1.6,0.81,-12],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-8"},{"type":"hex","terrain":"plains","height":0.5,"position":[-10.9,0.81,7.2],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-9"},{"type":"hex","terrain":"plains","height":0.5,"position":[-9.7,0.81,5.5],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-10"},{"type":"hex","terrain":"plains","height":0.5,"position":[-9.8,0.81,2.7],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-11"},{"type":"hex","terrain":"plains","height":0.5,"position":[-11.9,0.81,-0.3],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-12"},{"type":"hex","terrain":"plains","height":0.5,"position":[-12.4,0.81,2.2],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-13"},{"type":"hex","terrain":"plains","height":0.5,"position":[-11.2,0.81,-2.4],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-14"},{"type":"hex","terrain":"plains","height":0.5,"position":[5,0.81,-5.9],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-16"},{"type":"hex","terrain":"plains","height":0.5,"position":[7.3,0.81,-7.1],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-17"},{"type":"hex","terrain":"plains","height":0.5,"position":[-9,0.05,9.5],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-18"},{"type":"hex","terrain":"plains","height":0.5,"position":[-10.2,0.05,7],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-19"},{"type":"hex","terrain":"plains","height":0.5,"position":[-3.2,0.05,-11.4],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-20"},{"type":"king-base","owner":"gold","position":[-9.3,0.05,-5.4],"scale":[1,1,1],"rotation":[0,0,0],"id":"eobj-22"}],
  "shadow-marshes": [],
  "iron-ridges": [],
  "blightwood": [],
  "cinder-plains": [],
  "shattered-realm": [
    {"type":"king-base","owner":"silver","position":[-16.8,1.0,-9.7],"scale":[1,1,1],"rotation":[0,0,0],"id":"king-silver"},
    {"type":"king-base","owner":"gold","position":[16.8,1.0,9.7],"scale":[1,1,1],"rotation":[0,0,0],"id":"king-gold"},
  ],
};

export function getMapObjects(mapId) {
  return MAP_OBJECTS[mapId] || [];
}
