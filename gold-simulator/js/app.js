let priceEngine = null;
let eaEngine = null;
let chartManager = null;
let simulationTimer = null;
let isRunning = false;
let prevPositionCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    chartManager = new ChartManager('chartCanvas', 'volumeCanvas', 'equityCanvas');

    document.getElementById('btnStart').addEventListener('click', startSimulation);
    document.getElementById('btnPause').addEventListener('click', pauseSimulation);
    document.getElementById('btnReset').addEventListener('click', resetSimulation);

    document.getElementById('speed').addEventListener('change', () => {
        if (isRunning) {
            clearInterval(simulationTimer);
            const speed = parseInt(document.getElementById('speed').value);
            simulationTimer = setInterval(simulationStep, speed);
        }
    });

    document.getElementById('timeframe').addEventListener('change', () => {
        document.getElementById('chartTimeframe').textContent =
            document.getElementById('timeframe').value;
    });
});

function getConfig() {
    return {
        scenario: document.getElementById('scenario').value,
        startPrice: parseFloat(document.getElementById('startPrice').value),
        speed: parseInt(document.getElementById('speed').value),
        strategy: document.getElementById('eaStrategy').value,
        balance: parseFloat(document.getElementById('balance').value),
        lotSize: parseFloat(document.getElementById('lotSize').value),
        gridDistance: parseInt(document.getElementById('gridDistance').value),
        martingaleMultiplier: parseFloat(document.getElementById('martingaleMultiplier').value),
        maxLevels: parseInt(document.getElementById('maxLevels').value),
        takeProfit: parseFloat(document.getElementById('takeProfit').value),
        stopLoss: parseFloat(document.getElementById('stopLoss').value),
    };
}

function startSimulation() {
    const config = getConfig();

    if (!priceEngine || !eaEngine) {
        priceEngine = new PriceEngine(config.startPrice);
        eaEngine = new EAEngine(config);
        chartManager.clear();
        prevPositionCount = 0;
    }

    isRunning = true;
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnPause').disabled = false;

    disableInputs(true);

    simulationTimer = setInterval(simulationStep, config.speed);
}

function pauseSimulation() {
    isRunning = false;
    clearInterval(simulationTimer);
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;
}

function resetSimulation() {
    clearInterval(simulationTimer);
    isRunning = false;
    priceEngine = null;
    eaEngine = null;
    prevPositionCount = 0;

    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;
    disableInputs(false);

    chartManager.clear();

    const config = getConfig();
    updateUI({
        balance: config.balance,
        equity: config.balance,
        floatingPL: 0,
        marginUsed: 0,
        marginLevel: Infinity,
        totalLots: 0,
        openPositions: 0,
        recoveryLevel: 0,
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        maxDrawdown: 0,
        maxRecoveryLevel: 0,
        profitFactor: 0,
    }, config.startPrice, 0);

    document.getElementById('positionsList').innerHTML = '';
    document.getElementById('tradeHistory').innerHTML = '';
}

function simulationStep() {
    const config = getConfig();
    const candle = priceEngine.generateCandle(config.scenario);

    const prevClosedCount = eaEngine.closedTrades.length;
    const prevPosIds = new Set(eaEngine.positions.map(p => p.id));

    eaEngine.onNewCandle(candle, priceEngine);

    const newPositions = eaEngine.positions.filter(p => !prevPosIds.has(p.id));
    for (const pos of newPositions) {
        const markerType = pos.type === 'buy' ? 'buy_open' : 'sell_open';
        chartManager.addTradeMarker(priceEngine.candles.length - 1, markerType, pos.openPrice);
    }

    if (eaEngine.closedTrades.length > prevClosedCount) {
        const newClosed = eaEngine.closedTrades.slice(prevClosedCount);
        for (const trade of newClosed) {
            const markerType = trade.pl >= 0 ? 'close_profit' : 'close_loss';
            chartManager.addTradeMarker(priceEngine.candles.length - 1, markerType, trade.closePrice);
        }
    }

    chartManager.drawChart(priceEngine.candles, eaEngine.positions);
    chartManager.drawEquity(eaEngine.equityHistory, config.balance);

    const stats = eaEngine.getStats();
    updateUI(stats, candle.close, priceEngine.candles.length);

    updatePositionsList(eaEngine.positions);
    updateTradeHistory(eaEngine.closedTrades);

    if (eaEngine.marginCallTriggered) {
        pauseSimulation();
        showAlert(
            'MARGIN CALL / STOP OUT',
            `Account blown! Equity dropped to $${stats.equity.toFixed(2)}\n` +
            `Max Drawdown: $${stats.maxDrawdown.toFixed(2)}\n` +
            `Recovery Level reached: ${stats.maxRecoveryLevel}\n` +
            `Total trades: ${stats.totalTrades}`
        );
    }
}

function updateUI(stats, currentPrice, candleCount) {
    const startPrice = parseFloat(document.getElementById('startPrice').value);
    const change = currentPrice - startPrice;
    const changePct = (change / startPrice * 100);

    document.getElementById('chartPrice').textContent = currentPrice.toFixed(2);

    const changeEl = document.getElementById('chartChange');
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct.toFixed(2)}%)`;
    changeEl.className = change > 0 ? 'change-up' : change < 0 ? 'change-down' : 'change-neutral';

    document.getElementById('chartCandle').textContent = `Candle: ${candleCount}`;

    document.getElementById('accBalance').textContent = '$' + stats.balance.toFixed(2);

    const equityEl = document.getElementById('accEquity');
    equityEl.textContent = '$' + stats.equity.toFixed(2);
    equityEl.className = stats.equity >= stats.balance ? 'profit-text' : 'loss-text';

    document.getElementById('equityValue').textContent = '$' + stats.equity.toFixed(2);

    const floatingEl = document.getElementById('accFloating');
    floatingEl.textContent = (stats.floatingPL >= 0 ? '+$' : '-$') + Math.abs(stats.floatingPL).toFixed(2);
    floatingEl.className = stats.floatingPL >= 0 ? 'profit-text' : 'loss-text';

    document.getElementById('accMargin').textContent = '$' + stats.marginUsed.toFixed(2);
    document.getElementById('accMarginLevel').textContent =
        stats.marginLevel === Infinity ? '∞' : stats.marginLevel.toFixed(1) + '%';
    document.getElementById('accTotalLots').textContent = stats.totalLots.toFixed(2);
    document.getElementById('accOpenPos').textContent = stats.openPositions;
    document.getElementById('accRecoveryLevel').textContent = stats.recoveryLevel;

    document.getElementById('statTotalTrades').textContent = stats.totalTrades;
    document.getElementById('statWinTrades').textContent = stats.winTrades;
    document.getElementById('statLossTrades').textContent = stats.lossTrades;
    document.getElementById('statMaxDD').textContent = '$' + stats.maxDrawdown.toFixed(2);
    document.getElementById('statMaxRecovery').textContent = stats.maxRecoveryLevel;
    document.getElementById('statPF').textContent = stats.profitFactor.toFixed(2);
}

function updatePositionsList(positions) {
    const container = document.getElementById('positionsList');

    if (positions.length === 0) {
        container.innerHTML = '<div style="color:#555;padding:8px;text-align:center;font-size:11px">No open positions</div>';
        return;
    }

    let html = '';
    for (const pos of positions) {
        const plClass = pos.pl >= 0 ? 'profit-text' : 'loss-text';
        html += `
            <div class="position-item ${pos.type}">
                <span class="type ${pos.type}-type">${pos.type.toUpperCase()}</span>
                <span>${pos.lots.toFixed(2)}</span>
                <span>${pos.openPrice.toFixed(2)}</span>
                <span class="${plClass}">${pos.pl >= 0 ? '+' : ''}${pos.pl.toFixed(2)}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

function updateTradeHistory(trades) {
    const container = document.getElementById('tradeHistory');
    const recent = trades.slice(-20).reverse();

    if (recent.length === 0) {
        container.innerHTML = '<div style="color:#555;padding:8px;text-align:center;font-size:11px">No closed trades</div>';
        return;
    }

    let html = '';
    for (const t of recent) {
        const plClass = t.pl >= 0 ? 'profit' : 'loss';
        html += `
            <div class="trade-item">
                <span>#${t.id} ${t.type.toUpperCase()} ${t.lots} | ${t.openPrice.toFixed(2)} → ${t.closePrice.toFixed(2)}</span>
                <span class="${plClass}">${t.pl >= 0 ? '+' : ''}$${t.pl.toFixed(2)}</span>
            </div>
        `;
    }
    container.innerHTML = html;
}

function disableInputs(disabled) {
    const ids = ['scenario', 'startPrice', 'eaStrategy', 'balance', 'lotSize',
                 'gridDistance', 'martingaleMultiplier', 'maxLevels', 'takeProfit', 'stopLoss'];
    for (const id of ids) {
        document.getElementById(id).disabled = disabled;
    }
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertOverlay').classList.remove('hidden');
}

function closeAlert() {
    document.getElementById('alertOverlay').classList.add('hidden');
}
