/**
 * 光刻机数据管理系统 - 仪表板 JavaScript
 * 功能：机器列表管理、数据加载、UI交互
 */

class LithoDashboard {
    constructor() {
        this.currentMachine = null;
        this.machines = [];
        this.metrics = [];
        this.stats = {};
        
        // 初始化
        this.init();
    }

    /**
     * 初始化仪表板
     */
    async init() {
        try {
            this.updateDebugInfo('开始初始化...');
            
            // 获取机器列表
            this.updateDebugInfo('正在获取机器列表...');
            const machinesResponse = await fetch('/api/machines');
            this.updateDebugInfo(`API响应状态: ${machinesResponse.status}`);
            
            if (!machinesResponse.ok) {
                throw new Error(`网络响应错误: /api/machines, 状态: ${machinesResponse.status}`);
            }
            
            const machines = await machinesResponse.json();
            this.updateDebugInfo(`获取到 ${machines.length} 台机器`);
            
            this.machines = machines;
            this.populateMachineSelectorFromApi(machines);
            
            this.bindEvents();
            this.setupAutoRefresh();
            
            this.updateDebugInfo('初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            this.updateDebugInfo(`错误: ${error.message}`);
            // 显示错误信息到页面上
            const machineList = document.getElementById('machineList');
            if (machineList) {
                machineList.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>加载失败:</strong> ${error.message}
                    </div>
                `;
            }
        }
    }

    /**
     * 更新调试信息
     */
    updateDebugInfo(message) {
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.textContent = message;
        }
        console.log(message);
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('machineSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMachines(e.target.value);
            });
        }

        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }
    }

    /**
     * 填充机器选择器
     */
    populateMachineSelectorFromApi(machines) {
        console.log('开始填充机器列表...');
        const machineList = document.getElementById('machineList');
        console.log('找到machineList元素:', !!machineList);
        
        if (!machineList) {
            console.error('未找到machineList元素');
            return;
        }
        
        machineList.innerHTML = '';
        console.log('清空机器列表');
        
        let enabledCount = 0;
        machines.forEach(machine => {
            console.log('处理机器:', machine.machine_name, 'enabled:', machine.enabled);
            if (machine.enabled) {
                enabledCount++;
                const machineItem = document.createElement('div');
                machineItem.className = 'list-group-item list-group-item-action machine-item text-white border-0';
                machineItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${this.escapeHtml(machine.machine_name)}</strong>
                            <br>
                            <small class="text-light">${this.escapeHtml(machine.machine_type)}</small>
                        </div>
                        <span class="badge bg-success">
                            启用
                        </span>
                    </div>
                `;
                
                machineItem.addEventListener('click', () => {
                    console.log('点击机器:', machine.machine_name);
                    this.selectMachine(machine.machine_id, machine.machine_name);
                });
                
                machineList.appendChild(machineItem);
            }
        });
        
        console.log(`填充完成，共 ${enabledCount} 台启用的机器`);
        
        if (enabledCount === 0) {
            machineList.innerHTML = `
                <div class="text-center text-white">
                    <p>没有启用的机器</p>
                </div>
            `;
        }
    }

    /**
     * 渲染机器列表
     */
    renderMachineList() {
        const machineList = document.getElementById('machineList');
        if (!machineList) return;

        machineList.innerHTML = '';
        
        this.machines.forEach(machine => {
            const machineItem = this.createMachineItem(machine);
            machineList.appendChild(machineItem);
        });

        // 添加淡入动画
        this.addFadeInAnimation(machineList);
    }

    /**
     * 创建机器列表项
     */
    createMachineItem(machine) {
        const machineItem = document.createElement('div');
        machineItem.className = 'list-group-item list-group-item-action machine-item text-white border-0';
        machineItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${this.escapeHtml(machine.machine_name)}</strong>
                    <br>
                    <small class="text-light">${this.escapeHtml(machine.machine_type)}</small>
                </div>
                <span class="badge ${machine.enabled ? 'bg-success' : 'bg-secondary'}">
                    ${machine.enabled ? '启用' : '禁用'}
                </span>
            </div>
        `;
        
        machineItem.addEventListener('click', () => {
            if (machine.enabled) {
                this.selectMachine(machine.machine_id, machine.machine_name);
            }
        });
        
        return machineItem;
    }

    /**
     * 选择机器
     */
    async selectMachine(machineId, machineName) {
        this.currentMachine = machineId;
        
        // 更新UI状态
        this.updateMachineSelection(machineId);
        this.updatePageTitle(machineName);
        
        // 加载机器数据
        await this.loadMachineData(machineId);
        
        // 加载LUSU数据并显示图表
        await this.loadLusuDataAndChart(machineId);
    }

    /**
     * 更新机器选择状态
     */
    updateMachineSelection(machineId) {
        // 移除所有active状态
        document.querySelectorAll('.machine-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加当前机器的active状态
        const currentItem = document.querySelector(`[data-machine-id="${machineId}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }
    }

    /**
     * 更新页面标题
     */
    updatePageTitle(machineName) {
        const titleElement = document.getElementById('selectedMachine');
        if (titleElement) {
            titleElement.textContent = machineName;
            titleElement.classList.add('page-title');
        }
    }

    /**
     * 加载机器数据
     */
    async loadMachineData(machineId) {
        try {
            this.showLoading('dataContent', true);
            
            // 并行加载统计数据和详细数据
            const [statsResponse, metricsResponse] = await Promise.all([
                fetch(`/api/metrics/${machineId}/stats`),
                fetch(`/api/metrics/${machineId}?limit=100`)
            ]);
            
            if (!statsResponse.ok || !metricsResponse.ok) {
                throw new Error('数据加载失败');
            }
            
            this.stats = await statsResponse.json();
            this.metrics = await metricsResponse.json();
            
            // 更新UI
            this.updateStatsCards();
            this.updateDataTable();
            
        } catch (error) {
            console.error('加载机器数据失败:', error);
            this.showError('加载数据失败，请稍后重试');
        } finally {
            this.showLoading('dataContent', false);
        }
    }

    /**
     * 更新统计卡片
     */
    updateStatsCards() {
        const totalRecords = this.stats.reduce((sum, stat) => sum + parseInt(stat.record_count), 0);
        const metricTypes = this.stats.length;
        const lastUpdate = this.stats.length > 0 ? 
            new Date(Math.max(...this.stats.map(s => new Date(s.last_record)))) : 
            null;
        
        // 更新DOM
        this.updateElement('totalRecords', totalRecords);
        this.updateElement('metricTypes', metricTypes);
        this.updateElement('lastUpdate', lastUpdate ? 
            lastUpdate.toLocaleString('zh-CN') : '-');
        
        // 显示统计卡片
        const statsCards = document.getElementById('statsCards');
        if (statsCards) {
            statsCards.style.display = 'flex';
            this.addFadeInAnimation(statsCards);
        }
    }

    /**
     * 更新数据表格
     */
    updateDataTable() {
        const tableBody = document.getElementById('dataTableBody');
        const dataTable = document.getElementById('dataTable');
        const noData = document.getElementById('noData');
        
        if (!tableBody || !dataTable || !noData) return;
        
        tableBody.innerHTML = '';
        
        if (this.metrics.length === 0) {
            noData.style.display = 'block';
            dataTable.style.display = 'none';
            return;
        }
        
        // 渲染数据行
        this.metrics.forEach(metric => {
            const row = this.createDataRow(metric);
            tableBody.appendChild(row);
        });
        
        noData.style.display = 'none';
        dataTable.style.display = 'block';
        this.addFadeInAnimation(dataTable);
    }

    /**
     * 创建数据行
     */
    createDataRow(metric) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="badge bg-primary">${this.escapeHtml(metric.metric_name)}</span></td>
            <td><code>${this.escapeHtml(metric.metric_value)}</code></td>
            <td>${new Date(metric.record_timestamp).toLocaleString('zh-CN')}</td>
            <td><small class="text-muted">${this.escapeHtml(metric.source_file)}</small></td>
        `;
        return row;
    }

    /**
     * 过滤机器列表
     */
    filterMachines(searchTerm) {
        const machineItems = document.querySelectorAll('.machine-item');
        const term = searchTerm.toLowerCase();
        
        machineItems.forEach(item => {
            const machineName = item.querySelector('strong').textContent.toLowerCase();
            const machineType = item.querySelector('small').textContent.toLowerCase();
            
            if (machineName.includes(term) || machineType.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * 刷新数据
     */
    async refreshData() {
        if (this.currentMachine) {
            await this.loadMachineData(this.currentMachine);
            await this.loadLusuDataAndChart(this.currentMachine);
            this.showSuccess('数据已刷新');
        }
    }

    /**
     * 导出数据
     */
    exportData() {
        if (!this.currentMachine || this.metrics.length === 0) {
            this.showWarning('没有数据可导出');
            return;
        }
        
        const csvContent = this.convertToCSV(this.metrics);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `litho_data_${this.currentMachine}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 转换为CSV格式
     */
    convertToCSV(data) {
        const headers = ['机器ID', '指标名称', '指标值', '记录时间', '源文件'];
        const csvRows = [headers.join(',')];
        
        data.forEach(item => {
            const row = [
                item.machine_id,
                item.metric_name,
                `"${item.metric_value.replace(/"/g, '""')}"`,
                item.record_timestamp,
                item.source_file
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    /**
     * 设置自动刷新
     */
    setupAutoRefresh() {
        // 每5分钟自动刷新一次
        setInterval(() => {
            if (this.currentMachine) {
                this.loadMachineData(this.currentMachine);
                this.loadLusuDataAndChart(this.currentMachine);
            }
        }, 5 * 60 * 1000);
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(elementId, show) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (show) {
            element.classList.add('loading', 'show');
        } else {
            element.classList.remove('loading', 'show');
        }
    }

    /**
     * 显示错误消息
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 显示成功消息
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * 显示警告消息
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * 更新DOM元素
     */
    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * 添加淡入动画
     */
    addFadeInAnimation(element) {
        element.classList.add('fade-in');
        setTimeout(() => {
            element.classList.remove('fade-in');
        }, 500);
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 加载LUSU数据并显示图表
     */
    async loadLusuDataAndChart(machineId) {
        try {
            this.updateDebugInfo('加载LUSU数据...');
            
            // 获取处理后的LUSU数据
            const response = await fetch(`/api/lusu/${machineId}/processed`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.updateDebugInfo(`获取到 ${result.total_records} 条LUSU数据`);
            
            if (result.data.length === 0) {
                this.updateDebugInfo('没有LUSU数据');
                return;
            }
            
            // 转换为DataFrame格式（模拟）
            const lusuData = this.convertToDataFrame(result.data);
            
            // 显示筛选器和图表
            this.showLusuFilters(lusuData.filters);
            this.showLusuChart(lusuData.metrics);
            
        } catch (error) {
            console.error('加载LUSU数据失败:', error);
            this.updateDebugInfo(`LUSU数据加载失败: ${error.message}`);
        }
    }

    /**
     * 转换数据为DataFrame格式
     */
    convertToDataFrame(data) {
        // 模拟pandas DataFrame的处理
        const filters = {};
        const metrics = {};
        
        // 提取筛选条件
        const filterFields = ['XT_Illumination Mode', 'Ill_Mode', 'XT_NA', 'XT_Sigma Inner', 'XT_Sigma Outer'];
        const metricFields = ['XT_Slit_U', 'XT_Intensity', 'PAS_LISU_Uniformity', 'PAS_LISU_Intensity'];
        
        // 获取筛选选项
        filterFields.forEach(field => {
            const values = [...new Set(data.map(item => item[field]).filter(v => v != null))];
            if (values.length > 0) {
                filters[field] = values.sort();
            }
        });
        
        // 获取图表数据
        metricFields.forEach(field => {
            const validData = data
                .filter(item => item[field] != null)
                .map(item => ({
                    timestamp: item.record_timestamp,
                    value: parseFloat(item[field]) || 0
                }))
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (validData.length > 0) {
                metrics[field] = validData;
            }
        });
        
        return { filters, metrics };
    }

    /**
     * 显示LUSU筛选器
     */
    showLusuFilters(filters) {
        // 清除之前的筛选器
        const existingFilters = document.querySelector('.lusu-filters');
        if (existingFilters) {
            existingFilters.remove();
        }
        
        // 在数据内容区域添加筛选器
        const dataContent = document.getElementById('dataContent');
        if (!dataContent) return;
        
        // 创建筛选器容器
        let filtersHtml = `
            <div class="row mb-4 lusu-filters">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-funnel"></i> LUSU 筛选条件</h5>
                        </div>
                        <div class="card-body">
        `;
        
        Object.entries(filters).forEach(([filterName, values]) => {
            filtersHtml += `
                <div class="mb-3">
                    <label class="form-label"><strong>${filterName}</strong></label>
                    <div class="d-flex flex-wrap gap-2">
            `;
            
            values.forEach((value, index) => {
                const isShape = filterName === 'XT_Illumination Mode' || filterName === 'Ill_Mode';
                const inputType = isShape ? 'radio' : 'checkbox';
                const name = `filter-${filterName}`;
                const checked = isShape ? (index === 0 ? 'checked' : '') : 'checked';
                
                filtersHtml += `
                    <div class="form-check">
                        <input class="form-check-input" type="${inputType}" 
                               name="${name}" value="${value}" ${checked}
                               data-filter="${filterName}" onchange="window.lithoDashboard.onLusuFilterChange(event)">
                        <label class="form-check-label">${value}</label>
                    </div>
                `;
            });
            
            filtersHtml += `
                    </div>
                </div>
            `;
        });
        
        filtersHtml += `
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 插入到数据内容区域的开头
        dataContent.insertAdjacentHTML('afterbegin', filtersHtml);
    }

    /**
     * 显示LUSU图表
     */
    showLusuChart(metricsData) {
        // 清除旧图表
        const oldCharts = document.querySelectorAll('.lusu-chart');
        oldCharts.forEach(c => c.remove());

        const dataContent = document.getElementById('dataContent');
        if (!dataContent) return;

        // 分类指标
        const uniformityMetrics = {};
        const intensityMetrics  = {};
        Object.entries(metricsData).forEach(([name, data]) => {
            const lower = name.toLowerCase();
            if (/(uniformity|slit_u)/i.test(lower)) {
                uniformityMetrics[name] = data;
            } else if (/intensity/i.test(lower)) {
                intensityMetrics[name] = data;
            }
        });

        // 创建两个图表容器
        const chartsHtml = `
            <div class="row mb-4 lusu-chart">
                <div class="col-12 col-md-6 mb-3">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="bi bi-graph-up"></i> Uniformity</h6>
                        </div>
                        <div class="card-body"><div id="lusuChartUniformity" style="height: 350px;"></div></div>
                    </div>
                </div>
                <div class="col-12 col-md-6 mb-3">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="bi bi-graph-up"></i> Intensity</h6>
                        </div>
                        <div class="card-body"><div id="lusuChartIntensity" style="height: 350px;"></div></div>
                    </div>
                </div>
            </div>`;

        const filtersCard = dataContent.querySelector('.lusu-filters');
        if (filtersCard) {
            filtersCard.insertAdjacentHTML('afterend', chartsHtml);
        } else {
            dataContent.insertAdjacentHTML('afterbegin', chartsHtml);
        }

        // 初始化两张图
        this.initLusuChart(uniformityMetrics, 'lusuChartUniformity');
        this.initLusuChart(intensityMetrics, 'lusuChartIntensity');
    }

    /**
     * 初始化LUSU图表
     */
    initLusuChart(metricsData, domId = 'lusuChart') {
        // 检查ECharts库
        if (typeof echarts === 'undefined') {
            console.error('ECharts库未加载');
            this.updateDebugInfo('ECharts库未加载，无法显示图表');
            return;
        }
        
        const chartDom = document.getElementById(domId);
        if (!chartDom) {
            console.error('未找到图表容器');
            return;
        }
        
        const myChart = echarts.init(chartDom);
        
        // 准备图表数据
        const series = [];
        const colors = ['#5470C6', '#91CC75', '#FAC858', '#EE6666'];
        
        Object.entries(metricsData).forEach(([metricName, data], index) => {
            const seriesData = data.map(item => [
                new Date(item.timestamp),
                item.value
            ]);
            
            series.push({
                name: metricName,
                type: 'line',
                data: seriesData,
                symbol: 'circle',
                symbolSize: 6,
                color: colors[index % colors.length],
                smooth: true
            });
        });
        
        const option = {
            title: {
                text: 'LUSU 数据趋势',
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                },
                formatter: function(params) {
                    let result = `<div style="font-weight: bold;">${new Date(params[0].value[0]).toLocaleString('zh-CN')}</div>`;
                    params.forEach(param => {
                        result += `<div style="margin: 5px 0;">
                            <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; margin-right: 5px;"></span>
                            <span>${param.seriesName}: ${param.value[1].toFixed(4)}</span>
                        </div>`;
                    });
                    return result;
                }
            },
            legend: {
                data: Object.keys(metricsData),
                top: 'bottom',
                type: 'scroll'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '15%',
                containLabel: true
            },
            xAxis: {
                type: 'time',
                splitLine: {
                    show: false
                },
                axisLabel: {
                    formatter: function(value) {
                        return new Date(value).toLocaleDateString('zh-CN');
                    }
                }
            },
            yAxis: {
                type: 'value',
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                },
                axisLabel: {
                    formatter: '{value}'
                }
            },
            dataZoom: [
                {
                    type: 'slider',
                    start: 0,
                    end: 100,
                    height: 20,
                    bottom: 10
                },
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                }
            ],
            series: series
        };
        
        myChart.setOption(option);
        
        // 保存图表实例以便后续更新
        this.lusuChart = myChart;
        
        this.updateDebugInfo(`图表显示完成，共 ${series.length} 条曲线`);
    }

    /**
     * LUSU筛选器变化处理
     */
    async onLusuFilterChange(event) {
        if (!this.currentMachine) return;
        
        try {
            // 获取当前筛选条件
            const filters = this.getCurrentLusuFilters();
            
            // 构建查询参数
            const params = new URLSearchParams();
            if (filters['XT_Illumination Mode']) {
                params.append('illumination_mode', filters['XT_Illumination Mode'][0]);
            }
            if (filters['XT_NA']) {
                params.append('na', filters['XT_NA'][0]);
            }
            if (filters['XT_Sigma Inner']) {
                params.append('sigma_inner', filters['XT_Sigma Inner'][0]);
            }
            if (filters['XT_Sigma Outer']) {
                params.append('sigma_outer', filters['XT_Sigma Outer'][0]);
            }
            
            // 获取筛选后的图表数据
            const response = await fetch(`/api/lusu/${this.currentMachine}/chart?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.chart_data && Object.keys(result.chart_data).length > 0) {
                // 更新图表
                this.updateLusuChart(result.chart_data);
                this.updateDebugInfo(`筛选后显示 ${result.filtered_records} 条记录`);
            } else {
                this.updateDebugInfo('筛选后没有数据');
            }
            
        } catch (error) {
            console.error('筛选数据失败:', error);
            this.updateDebugInfo(`筛选失败: ${error.message}`);
        }
    }

    /**
     * 获取当前LUSU筛选条件
     */
    getCurrentLusuFilters() {
        const filters = {};
        const filterInputs = document.querySelectorAll('.lusu-filters input[data-filter]');
        
        filterInputs.forEach(input => {
            const filterName = input.dataset.filter;
            if (!filters[filterName]) {
                filters[filterName] = [];
            }
            
            if (input.type === 'radio' && input.checked) {
                filters[filterName] = [input.value];
            } else if (input.type === 'checkbox' && input.checked) {
                filters[filterName].push(input.value);
            }
        });
        
        return filters;
    }

    /**
     * 更新LUSU图表
     */
    updateLusuChart(chartData) {
        this.showLusuChart(chartData);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.lithoDashboard = new LithoDashboard();
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LithoDashboard;
} 