Differences in this fork:
Adds partial support for CoreML MIL (model intermediate language) and espresso.

Espresso is partially based on [this converter](https://github.com/AsuharietYgvar/TNN/blob/1a637d88cc5e388f6fb31291e7df0d563238e785/tools/onnx2tnn/onnx-coreml/coreml2onnx.py). MIL is based on the official docs, but only a small fraction (notably information about const and weights are lacking).

---

<div align="center">
<img width="400px" height="100px" src="https://github.com/lutzroeder/netron/raw/main/.github/logo-light.svg#gh-light-mode-only">
<img width="400px" height="100px" src="https://github.com/lutzroeder/netron/raw/main/.github/logo-dark.svg#gh-dark-mode-only">
</div>

Netron is a viewer for neural network, deep learning and machine learning models. 

Netron supports ONNX, TensorFlow Lite, Core ML, Keras, Caffe, Darknet, MXNet, PaddlePaddle, ncnn, MNN and TensorFlow.js.

Netron has experimental support for PyTorch, TorchScript, TensorFlow, OpenVINO, RKNN, MediaPipe, ML.NET and scikit-learn.

<p align='center'><a href='https://www.lutzroeder.com/ai'><img src='.github/screenshot.png' width='800'></a></p>

## Install

**macOS**: [**Download**](https://github.com/lutzroeder/netron/releases/latest) the `.dmg` file or run `brew install --cask netron`

**Linux**: [**Download**](https://github.com/lutzroeder/netron/releases/latest) the `.AppImage` file or run `snap install netron`

**Windows**: [**Download**](https://github.com/lutzroeder/netron/releases/latest) the `.exe` installer or run `winget install -s winget netron`

**Browser**: [**Start**](https://netron.app) the browser version.

**Python Server**: Run `pip install netron` and `netron [FILE]` or `netron.start('[FILE]')`.

## Models

Sample model files to download or open using the browser version:

 * **ONNX**: [squeezenet](https://media.githubusercontent.com/media/onnx/models/main/vision/classification/squeezenet/model/squeezenet1.0-3.onnx) [[open](https://netron.app?url=https://media.githubusercontent.com/media/onnx/models/main/vision/classification/squeezenet/model/squeezenet1.0-3.onnx)]
 * **TensorFlow Lite**: [yamnet](https://huggingface.co/thelou1s/yamnet/resolve/main/lite-model_yamnet_tflite_1.tflite) [[open](https://netron.app?url=https://huggingface.co/thelou1s/yamnet/blob/main/lite-model_yamnet_tflite_1.tflite)]
 * **TensorFlow**: [chessbot](https://raw.githubusercontent.com/srom/chessbot/master/model/chessbot.pb) [[open](https://netron.app?url=https://raw.githubusercontent.com/srom/chessbot/master/model/chessbot.pb)]
 * **Keras**: [mobilenet](https://raw.githubusercontent.com/aio-libs/aiohttp-demos/master/demos/imagetagger/tests/data/mobilenet.h5) [[open](https://netron.app?url=https://raw.githubusercontent.com/aio-libs/aiohttp-demos/master/demos/imagetagger/tests/data/mobilenet.h5)]
 * **TorchScript**: [traced_online_pred_layer](https://raw.githubusercontent.com/ApolloAuto/apollo/master/modules/prediction/data/traced_online_pred_layer.pt) [[open](https://netron.app?url=https://raw.githubusercontent.com/ApolloAuto/apollo/master/modules/prediction/data/traced_online_pred_layer.pt)]
 * **Core ML**: [exermote](https://raw.githubusercontent.com/Lausbert/Exermote/master/ExermoteInference/ExermoteCoreML/ExermoteCoreML/Model/Exermote.mlmodel) [[open](https://netron.app?url=https://raw.githubusercontent.com/Lausbert/Exermote/master/ExermoteInference/ExermoteCoreML/ExermoteCoreML/Model/Exermote.mlmodel)]
 * **Darknet**: [yolo](https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolo.cfg) [[open](https://netron.app?url=https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolo.cfg)]
