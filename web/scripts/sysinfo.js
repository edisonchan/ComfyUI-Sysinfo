import {
    app
} from "../../../scripts/app.js";
import {
    api
} from "../../../scripts/api.js";

// Inject CSS styles
const style = document.createElement("style");
style.textContent = `
.info-item {
  display: flex; justify-content: space-between;
  margin-bottom: 4px; padding: 2px 4px;
  background-color: #3a3a3a; border-radius: 2px;
  font-size: 10px; transition: background-color 0.2s ease;
}
.info-item:hover { background-color: #4a4a4a !important; }
.info-item.error { color: #f55; text-align: center; padding: 8px; }
.info-item-label { color: #aaa; font-weight: bold; white-space: nowrap; margin-right: 8px; }
.info-item-value { color: #fff; text-align: right; word-break: break-word; }
.info-item-value.not-installed { color: #f55; }
.sysinfo-button {
  padding: 4px 8px; width: 100%; height: 28px;
  box-sizing: border-box; font-size: 12px;
  background-color: #4a6fa5; color: #fff;
  border: none; border-radius: 3px;
  margin-bottom: 12px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 20px;
}
.sysinfo-button:hover { background-color: #5b80b5 !important; }
.sysinfo-button:active { background-color: #3a5f95 !important; }
`;
document.head.appendChild(style);

// Libraries to check
const LIBRARIES = [
    "torchvision", "torchaudio", "xformers", "sageattention", "nunchaku",
    "peft", "triton", "opencv", "pillow", "numpy", "transformers", "diffusers"
];

// Create info item
function createInfoItem(container, label, value, isMissing = false) {
    const item = document.createElement("div");
    item.className = "info-item";
    item.innerHTML = `
	<span class="info-item-label">${label}</span>
	<span class="info-item-value${isMissing ? " not-installed" : ""}">${value}</span>
  `;
    container.appendChild(item);
}

// Adjust node size based on content and layout
function adjustNodeSize(node, container, button, wrapper) {
    // 获取容器内容的真实高度（包括所有 info-item）
    const contentHeight = container.scrollHeight;

    // 获取按钮和容器的额外占位空间
    const buttonHeight = button.offsetHeight;
    const buttonMarginBottom = parseInt(getComputedStyle(button).marginBottom);
    const containerPadding = parseInt(getComputedStyle(wrapper).padding);
    const extraHeight = buttonHeight + buttonMarginBottom + containerPadding * 2;

    // 冗余缓冲：一条信息条的高度 + 滚动条空间
    const buffer = 28;

    // 计算最终高度
    const newHeight = Math.min(1000, contentHeight + extraHeight + buffer);

    // 动态计算最大宽度
    const items = container.querySelectorAll(".info-item");
    const maxWidth = [...items].reduce((w, el) => Math.max(w, el.scrollWidth), 0);
    const newWidth = Math.max(300, maxWidth + 40);

    // 设置节点尺寸
    node.setSize([newWidth, newHeight]);
    node.onResize?.();
}


// Update info container height when node resizes
function updateInfoContainerHeight(node, button, wrapper, container) {
    const buttonHeight = button.offsetHeight;
    const buttonMarginBottom = parseInt(getComputedStyle(button).marginBottom);
    const containerPadding = parseInt(getComputedStyle(wrapper).padding);
    const availableHeight = node.size[1] - buttonHeight - buttonMarginBottom - containerPadding * 2;
    if (availableHeight > 100) {
        container.style.height = `${availableHeight}px`;
    }
}

// Register node
app.registerExtension({
    name: "Comfy.Sysinfo",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "SysInfoDisplay") return;

        const originalCreate = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const r = originalCreate?.apply(this, arguments);
            const node = this;

            node.setSize([400, 200]); // 默认大小

            const button = document.createElement("button");
            button.className = "sysinfo-button";
            button.textContent = "Run System Info Check";

            const container = document.createElement("div");
            container.style.flex = "1";
            container.style.overflowY = "auto";
            container.style.minHeight = "100px";

            button.onclick = async () => {
                button.disabled = true;
                button.textContent = "Checking...";
                container.innerHTML = "";

                try {
                    const res = await api.fetchApi("/sysinfo/check", {
                        method: "POST"
                    });
                    if (!res.ok) throw new Error(`Status ${res.status}`);
                    const data = await res.json();

                    createInfoItem(container, "Python version", data.python_version || "Unknown");
                    createInfoItem(container, "Operating System", `${data.os.system} ${data.os.release}`);
                    createInfoItem(container, "CPU", data.cpu.brand || "Unknown");
                    createInfoItem(container, "CPU Cores", `${data.cpu.physical_cores}P + ${data.cpu.logical_cores - data.cpu.physical_cores}L = ${data.cpu.logical_cores}T`);
                    createInfoItem(container, "CPU Usage", `${data.cpu.usage}%`);
                    createInfoItem(container, "System RAM", `${data.system_ram_gb}GB (${data.memory.available}GB available)`);

                    const gpu = data.cuda.available ?
                        `${data.gpu.name} ${data.cuda.vram_gb}GB (SM ${data.gpu.capability})` :
                        "No GPU available";
                    createInfoItem(container, "GPU", gpu);

                    LIBRARIES.forEach(lib => {
                        const key = lib.toLowerCase().replace(/[\s-]/g, "_") + "_version";
                        const version = data[key] || "Not installed";
                        createInfoItem(container, lib, version, version === "Not installed");
                    });

                    setTimeout(() => {
                        adjustNodeSize(node, container, button, wrapper);
                        updateInfoContainerHeight(node, button, wrapper, container);
                    }, 100);
                } catch (err) {
                    console.error("Sysinfo error:", err);
                    const errorItem = document.createElement("div");
                    errorItem.className = "info-item error";
                    errorItem.textContent = "Failed to get system information";
                    container.appendChild(errorItem);
                } finally {
                    button.disabled = false;
                    button.textContent = "Run System Info Check";
                }
            };

            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.flexDirection = "column";
            wrapper.style.height = "100%";
            wrapper.style.padding = "10px";
            wrapper.appendChild(button);
            wrapper.appendChild(container);

            node.addDOMWidget("sysinfo_wrapper", "div", wrapper, {
                onSizeChanged: () => updateInfoContainerHeight(node, button, wrapper, container)
            });

            setTimeout(() => updateInfoContainerHeight(node, button, wrapper, container), 100);
            return r;
        };
    }
});
