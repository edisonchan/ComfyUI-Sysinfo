import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

// Add CSS styles
const style = document.createElement('style');
style.textContent = `
    .info-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        padding: 2px 4px;
        background-color: #3a3a3a;
        border-radius: 2px;
        font-size: 10px;
        transition: background-color 0.2s ease;
    }
    .info-item:hover {
        background-color: #4a4a4a !important;
    }
    .info-item.error {
        color: #f55;
        text-align: center;
        padding: 8px;
    }
    .info-item-label {
        color: #aaa;
        font-weight: bold;
        white-space: nowrap;
        margin-right: 8px;
    }
    .info-item-value {
        color: #fff;
        text-align: right;
        word-break: break-word;
    }
    .info-item-value.not-installed {
        color: #f55;
    }
`;
document.head.appendChild(style);

// Define the list of libraries to display
const LIBRARIES_TO_DISPLAY = [
    "torchvision",
    "torchaudio",
    "xformers",
    "sageattention",
    "nunchaku",
    "peft",
    "triton",
    "opencv",
    "pillow",
    "numpy",
    "transformers",
    "diffusers"
];

app.registerExtension({
    name: "Comfy.Sysinfo",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "SysInfoDisplay") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // Store reference to the current node instance
                const nodeInstance = this;
                nodeInstance.setSize([400, 200]); // 默认宽度400，高度200
                
                // Create refresh button - fixed height
                const button = document.createElement("button");
                button.textContent = "Run System Info Check";
                button.style.padding = "4px 8px";
                button.style.width = "100%";
                button.style.cursor = "pointer";
                button.style.height = "28px";
                button.style.minHeight = "28px";
                button.style.maxHeight = "28px";
                button.style.boxSizing = "border-box";
                button.style.lineHeight = "20px";
                button.style.fontSize = "12px";
                button.style.overflow = "hidden";
                button.style.whiteSpace = "nowrap";
                button.style.textOverflow = "ellipsis";
                button.style.backgroundColor = "#4a6fa5";
                button.style.color = "#fff";
                button.style.border = "none";
                button.style.borderRadius = "3px";
                button.style.marginBottom = "12px";
                
                // Add hover effects
                button.addEventListener("mouseover", () => {
                    button.style.backgroundColor = "#5b80b5";
                });
                button.addEventListener("mouseout", () => {
                    button.style.backgroundColor = "#4a6fa5";
                });
                button.addEventListener("mousedown", () => {
                    button.style.backgroundColor = "#3a5f95";
                });
                button.addEventListener("mouseup", () => {
                    button.style.backgroundColor = "#5b80b5";
                });
                
                // Create information display container - use multiple independent info items
                const infoContainer = document.createElement("div");
                infoContainer.style.flex = "1";
                infoContainer.style.overflowY = "auto";
                infoContainer.style.minHeight = "100px";
                
                // Add button click event
                button.addEventListener("click", async () => {
                    button.disabled = true;
                    button.textContent = "Checking...";
                    
                    try {
                        // Directly call API to get system information
                        const response = await api.fetchApi("/sysinfo/check", {
                            method: "POST"
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            // Clear container
                            infoContainer.innerHTML = "";
                            
                            // Create basic system information
                            createInfoItem(infoContainer, "Python version", data.python_version || "Unknown");
                            createInfoItem(infoContainer, "Operating System", `${data.os.system} ${data.os.release}`);
                            
                            // Use cpuinfo to get CPU brand information
                            createInfoItem(infoContainer, "CPU", data.cpu.brand || "Unknown");
                            createInfoItem(infoContainer, "CPU Cores", `${data.cpu.physical_cores}P + ${data.cpu.logical_cores - data.cpu.physical_cores}L = ${data.cpu.logical_cores}T`);
                            createInfoItem(infoContainer, "CPU Usage", `${data.cpu.usage}%`);
                            
                            // Add system memory information display
                            createInfoItem(infoContainer, "System RAM", `${data.system_ram_gb}GB (${data.memory.available}GB available)`);
                            
                            // Modify GPU information format - use new VRAM information
                            let gpuStatus = "No GPU available";
                            if (data.cuda.available) {
                                gpuStatus = `${data.gpu.name} ${data.cuda.vram_gb}GB(SM ${data.gpu.capability})`;
                            }
                            createInfoItem(infoContainer, "GPU", gpuStatus);
                            
                            // Create PyTorch information
                            createInfoItem(infoContainer, "PyTorch", data.pytorch.version || "Unknown");
                            
                            // Use loop to create information for all libraries
                            LIBRARIES_TO_DISPLAY.forEach(libName => {
                                const key = libName.toLowerCase().replace(" ", "_").replace("-", "_") + "_version";
                                const version = data[key] || "Not installed";
                                const isNotInstalled = version === "Not installed";
                                createInfoItem(infoContainer, libName, version, isNotInstalled);
                            });
                            
                            // Adjust node size after getting information
                            setTimeout(() => {
                                adjustNodeSize(nodeInstance, infoContainer);
                            }, 100);
                            
                        } else {
                            console.error("API request failed:", response.status);
                            const errorItem = document.createElement("div");
                            errorItem.className = "info-item error";
                            errorItem.textContent = "Failed to get system information";
                            infoContainer.appendChild(errorItem);
                        }
                    } catch (error) {
                        console.error("API request error:", error);
                        const errorItem = document.createElement("div");
                        errorItem.className = "info-item error";
                        errorItem.textContent = "Request error: " + error.message;
                        infoContainer.appendChild(errorItem);
                    } finally {
                        button.disabled = false;
                        button.textContent = "Run System Check";
                    }
                });
                
                // Create a container to wrap all elements using Flex layout
                const containerWrapper = document.createElement("div");
                containerWrapper.style.display = "flex";
                containerWrapper.style.flexDirection = "column";
                containerWrapper.style.height = "100%";
                containerWrapper.style.padding = "10px";
                
                // Add button and info container to wrapper container
                containerWrapper.appendChild(button);
                containerWrapper.appendChild(infoContainer);
                
                // Add wrapper container to node
                this.addDOMWidget("sysinfo_wrapper", "div", containerWrapper, {
                    // Set size change callback
                    onSizeChanged: (width, height) => {
                        // Adjust info container height when node size changes
                        const buttonHeight = button.offsetHeight;
                        const buttonMarginBottom = parseInt(getComputedStyle(button).marginBottom);
                        const containerPadding = parseInt(getComputedStyle(containerWrapper).padding);
                        const availableHeight = height - buttonHeight - buttonMarginBottom - (containerPadding * 2);
                        
                        if (availableHeight > 100) {
                            infoContainer.style.height = `${availableHeight}px`;
                        }
                    }
                });
                
                // Initial size adjustment
                setTimeout(() => {
                    const width = nodeInstance.size[0];
                    const height = nodeInstance.size[1];
                    if (width && height) {
                        const buttonHeight = button.offsetHeight;
                        const buttonMarginBottom = parseInt(getComputedStyle(button).marginBottom);
                        const containerPadding = parseInt(getComputedStyle(containerWrapper).padding);
                        const availableHeight = height - buttonHeight - buttonMarginBottom - (containerPadding * 2);
                        
                        if (availableHeight > 100) {
                            infoContainer.style.height = `${availableHeight}px`;
                        }
                    }
                }, 100);
                
                return r;
            };
        }
    },
});

// Function to create info item
function createInfoItem(container, label, value, isNotInstalled = false) {
    const item = document.createElement("div");
    item.className = "info-item";
    
    const labelSpan = document.createElement("span");
    labelSpan.className = "info-item-label";
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement("span");
    valueSpan.className = "info-item-value";
    if (isNotInstalled) {
        valueSpan.classList.add("not-installed");
    }
    valueSpan.textContent = value;
    
    item.appendChild(labelSpan);
    item.appendChild(valueSpan);
    container.appendChild(item);
}

function adjustNodeSize(nodeInstance, infoContainer) {
    const infoItems = infoContainer.querySelectorAll('.info-item');
    
    // 宽度计算（保持原逻辑）
    let maxWidth = 0;
    infoItems.forEach(item => {
        const itemWidth = item.scrollWidth;
        if (itemWidth > maxWidth) {
            maxWidth = itemWidth;
        }
    });
    const padding = 40;
    const newWidth = Math.max(300, maxWidth + padding);

    // 高度计算（新增逻辑）
    const itemHeight = 20; // 每条信息估算高度
    const buttonHeight = 28; // 按钮固定高度
    const buttonMarginBottom = 12;
    const containerPadding = 20; // 上下 padding 共计
    const newHeight = Math.max(150, infoItems.length * itemHeight + buttonHeight + buttonMarginBottom + containerPadding);

    // 设置新尺寸
    nodeInstance.setSize([newWidth, newHeight]);

    // 触发尺寸变更回调
    if (nodeInstance.onResize) {
        nodeInstance.onResize();
    }
}
