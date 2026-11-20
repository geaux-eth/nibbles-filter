# Voice fingerprints

`voice.bin` / `voice.json`: the WeSpeaker ResNet34-LM speaker-embedding model trained on VoxCeleb
(https://github.com/wenet-e2e/wespeaker, model page https://wenet-e2e.github.io/wespeaker/pretrained.html),
licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0), as its dataset is.

Changed from the original: the weights are stored in 8 bits (one scale per output channel), and the layers are run by
the page itself (TensorFlow.js) instead of ONNX Runtime. Used by Nibble FILTER to tell voices apart, on the device.
