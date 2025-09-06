# ComfyUI-Sysinfo 节点

一个简单的ComfyUI自定义节点，用于检查系统CUDA信息和PyTorch版本。

## 功能

- 检查 CUDA 是否可用
- 显示 CUDA 版本
- 显示可用 GPU 设备数量和名称
- 显示 PyTorch 等模块版本

## 安装

1. 将此文件夹放入 `ComfyUI/custom_nodes/`
  
   或者在 ComfyUI-Manager 中以用 Git 方式安装（输入 https://github.com/edisonchan/Comfyui-Sysinfo）；

   又或者是在 custom_nodes 文件夹里执行：
   ```git clone https://github.com/edisonchan/Comfyui-Sysinfo```

2. 重启ComfyUI

## 使用

1. 在节点菜单中找到"System Info"节点
2. 添加到工作流中
3. 点击"Check System Info"按钮
4. 执行工作流查看结果

## 输出

节点输出一个包含系统信息的字符串，可以连接到文本显示节点或查看控制台输出。
