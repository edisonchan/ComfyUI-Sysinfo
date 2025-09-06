import torch
import psutil
import platform
import json
import sys
import subprocess
import re
import cpuinfo
from server import PromptServer
from aiohttp import web
from functools import lru_cache

LIBRARIES_TO_CHECK = [
    {"display_name": "torchvision", "import_name": "torchvision", "package_name": "torchvision"},
    {"display_name": "torchaudio", "import_name": "torchaudio", "package_name": "torchaudio"},
    {"display_name": "xformers", "import_name": "xformers", "package_name": "xformers"},
    {"display_name": "sageattention", "import_name": "sageattention", "package_name": "sageattention"},
    {"display_name": "nunchaku", "import_name": "nunchaku", "package_name": "nunchaku"},
    {"display_name": "peft", "import_name": "peft", "package_name": "peft"},
    {"display_name": "Triton", "import_name": "triton", "package_name": "triton"},
    {"display_name": "OpenCV", "import_name": "cv2", "package_name": "opencv-python"},
    {"display_name": "Pillow", "import_name": "PIL", "package_name": "Pillow"},
    {"display_name": "numpy", "import_name": "numpy", "package_name": "numpy"},
    {"display_name": "transformers", "import_name": "transformers", "package_name": "transformers"},
    {"display_name": "diffusers", "import_name": "diffusers", "package_name": "diffusers"}
]

@lru_cache(maxsize=1)
def get_cpu_info():
    try:
        info = cpuinfo.get_cpu_info()
        return {
            "brand": info.get('brand_raw', 'Unknown CPU'),
            "arch": platform.machine(),
            "physical_cores": psutil.cpu_count(logical=False),
            "logical_cores": psutil.cpu_count(logical=True),
            "hz_actual": info.get('hz_actual', 'N/A'),
            "hz_advertised": info.get('hz_advertised', 'N/A')
        }
    except:
        return {
            "brand": "Unknown CPU",
            "arch": platform.machine(),
            "physical_cores": psutil.cpu_count(logical=False),
            "logical_cores": psutil.cpu_count(logical=True),
            "hz_actual": "N/A",
            "hz_advertised": "N/A"
        }

@lru_cache(maxsize=1)
def get_system_ram():
    try:
        return round(psutil.virtual_memory().total / (1024 ** 3))
    except:
        return 0

@lru_cache(maxsize=1)
def get_vram():
    try:
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(torch.cuda.current_device())
            return round(props.total_memory / (1024 ** 3))
        return 0
    except:
        return 0

@lru_cache(maxsize=1)
def get_gpu_info():
    if not torch.cuda.is_available():
        return {"name": "No GPU available", "capability": "N/A"}
    try:
        props = torch.cuda.get_device_properties(torch.cuda.current_device())
        return {
            "name": props.name,
            "capability": f"{props.major}.{props.minor}"
        }
    except:
        return {"name": "Unknown GPU", "capability": "N/A"}

@lru_cache(maxsize=1)
def get_os_info():
    try:
        return {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "platform": platform.platform()
        }
    except:
        return {
            "system": "Unknown",
            "release": "Unknown",
            "version": "Unknown",
            "platform": "Unknown"
        }

@lru_cache(maxsize=1)
def get_cuda_info():
    available = torch.cuda.is_available()
    return {
        "available": available,
        "version": torch.version.cuda if hasattr(torch.version, 'cuda') else 'N/A',
        "device_count": torch.cuda.device_count() if available else 0,
        "vram_gb": get_vram()
    }

@lru_cache(maxsize=1)
def get_pytorch_info():
    return {"version": torch.__version__}

def get_dynamic_memory_info():
    try:
        mem = psutil.virtual_memory()
        return {
            "available": round(mem.available / (1024**3), 1),
            "percent": mem.percent
        }
    except:
        return {"available": 0, "percent": 0}

def get_dynamic_cpu_info():
    try:
        return {"usage": psutil.cpu_percent(interval=0.1)}
    except:
        return {"usage": 0}

@lru_cache(maxsize=1)
def build_pip_version_map():
    try:
        result = subprocess.run([sys.executable, "-m", "pip", "list", "--format=json"], capture_output=True, text=True, check=True)
        packages = json.loads(result.stdout)
        return {pkg["name"].lower(): pkg["version"] for pkg in packages}
    except:
        return {}

PIP_VERSION_MAP = build_pip_version_map()

def check_library_version(display_name, import_name, package_name):
    package_name = package_name.lower()
    if display_name == "Triton":
        if platform.system() == "Windows":
            if "triton-windows" in PIP_VERSION_MAP:
                return PIP_VERSION_MAP["triton-windows"]
        if package_name in PIP_VERSION_MAP:
            return PIP_VERSION_MAP[package_name]
        for name, version in PIP_VERSION_MAP.items():
            if re.match(r'^triton', name, re.IGNORECASE):
                return version
        return "Not installed"
    return PIP_VERSION_MAP.get(package_name, "Not installed")

@lru_cache(maxsize=1)
def get_all_library_versions():
    versions = {}
    for lib in LIBRARIES_TO_CHECK:
        v = check_library_version(lib["display_name"], lib["import_name"], lib["package_name"])
        key = lib["display_name"].lower().replace(" ", "_").replace("-", "_") + "_version"
        versions[key] = v
    return versions

def generate_system_info():
    info = {
        "python_version": sys.version.split()[0],
        "os": get_os_info(),
        "cpu": {**get_cpu_info(), **get_dynamic_cpu_info()},
        "system_ram_gb": get_system_ram(),
        "memory": {
            "total": get_system_ram(),
            "available": get_dynamic_memory_info()["available"],
            "percent": get_dynamic_memory_info()["percent"]
        },
        "gpu": get_gpu_info(),
        "cuda": get_cuda_info(),
        "pytorch": get_pytorch_info(),
    }
    info.update(get_all_library_versions())
    return info

class CheckSystemInfoNode:
    CATEGORY = "utils"
    FUNCTION = "get_system_info"
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {}

    RETURN_TYPES = ()
    RETURN_NAMES = ()

    def get_system_info(self):
        info = generate_system_info()
        info_str = json.dumps(info, indent=2, ensure_ascii=False)
        return {"ui": {"text": info_str}}

def setup_routes():
    @PromptServer.instance.routes.post("/sysinfo/check")
    async def check_system_info(request):
        info = generate_system_info()
        return web.json_response(info)

NODE_CLASS_MAPPINGS = {
    "SysInfoDisplay": CheckSystemInfoNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SysInfoDisplay": "System Info"
}

setup_routes()
