# Cryptoclaw

Cryptoclaw is a project built on top of [OpenClaw](https://github.com/pjasicek/OpenClaw), the open-source multiplatform reimplementation of the classic 1997 platformer game Captain Claw.

## Prerequisites

### Linux (Ubuntu/Debian)

```bash
sudo apt install cmake libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libsdl2-gfx-dev
```

### Windows

- CMake 3.2+
- Visual Studio 2017 or later (or another CMake-compatible C++ compiler)
- The SDL2 libraries bundled with OpenClaw are used automatically on Windows.

## Getting Started

Clone the repository with its submodules:

```bash
git clone --recurse-submodules https://github.com/becominggiantcollective/Cryptoclaw.git
cd Cryptoclaw
```

If you already cloned without `--recurse-submodules`, initialize the submodules manually:

```bash
git submodule update --init --recursive
```

## Building

```bash
mkdir build
cd build
cmake ..
cmake --build .
```

The resulting `openclaw` binary will be placed in the `third_party/openclaw/Build_Release` directory.

## Running

OpenClaw requires the original game assets (`CLAW.REZ`) from the Captain Claw (1997) CD or installation. Copy `CLAW.REZ` into `third_party/openclaw/Build_Release`, then create `ASSETS.ZIP` from the contents of the `ASSETS` directory:

```bash
cd third_party/openclaw/Build_Release/ASSETS
zip -r ../ASSETS.ZIP .
cd ..
```

Then run:

```bash
cd third_party/openclaw/Build_Release
./openclaw
```

## License

This project is licensed under the [MIT License](LICENSE).  
OpenClaw is licensed separately — see [`third_party/openclaw/LICENSE.txt`](third_party/openclaw/LICENSE.txt).