class ChartManager {
    constructor(chartCanvasId, volumeCanvasId, equityCanvasId) {
        this.chartCanvas = document.getElementById(chartCanvasId);
        this.volumeCanvas = document.getElementById(volumeCanvasId);
        this.equityCanvas = document.getElementById(equityCanvasId);

        this.chartCtx = this.chartCanvas.getContext('2d');
        this.volumeCtx = this.volumeCanvas.getContext('2d');
        this.equityCtx = this.equityCanvas.getContext('2d');

        this.maxVisibleCandles = 100;
        this.candleWidth = 8;
        this.candleGap = 2;

        this.tradeMarkers = [];

        this._setupResize();
        this._resize();
    }

    _setupResize() {
        const ro = new ResizeObserver(() => this._resize());
        ro.observe(this.chartCanvas.parentElement);

        const ero = new ResizeObserver(() => this._resizeEquity());
        ero.observe(this.equityCanvas.parentElement);
    }

    _resize() {
        const parent = this.chartCanvas.parentElement;
        const header = parent.querySelector('.chart-header');
        const volumeH = 60;
        const headerH = header ? header.offsetHeight : 32;

        const w = parent.clientWidth;
        const h = parent.clientHeight - headerH - volumeH - 2;

        this.chartCanvas.width = w * devicePixelRatio;
        this.chartCanvas.height = Math.max(h, 100) * devicePixelRatio;
        this.chartCanvas.style.width = w + 'px';
        this.chartCanvas.style.height = Math.max(h, 100) + 'px';
        this.chartCtx.scale(devicePixelRatio, devicePixelRatio);

        this.volumeCanvas.width = w * devicePixelRatio;
        this.volumeCanvas.height = volumeH * devicePixelRatio;
        this.volumeCanvas.style.width = w + 'px';
        this.volumeCanvas.style.height = volumeH + 'px';
        this.volumeCtx.scale(devicePixelRatio, devicePixelRatio);

        this.chartWidth = w;
        this.chartHeight = Math.max(h, 100);
        this.volumeHeight = volumeH;

        this.maxVisibleCandles = Math.floor(w / (this.candleWidth + this.candleGap));
    }

    _resizeEquity() {
        const parent = this.equityCanvas.parentElement;
        const header = parent.querySelector('.chart-header');
        const headerH = header ? header.offsetHeight : 32;

        const w = parent.clientWidth;
        const h = parent.clientHeight - headerH;

        this.equityCanvas.width = w * devicePixelRatio;
        this.equityCanvas.height = Math.max(h, 50) * devicePixelRatio;
        this.equityCanvas.style.width = w + 'px';
        this.equityCanvas.style.height = Math.max(h, 50) + 'px';
        this.equityCtx.scale(devicePixelRatio, devicePixelRatio);

        this.equityWidth = w;
        this.equityHeight = Math.max(h, 50);
    }

    addTradeMarker(candleIndex, type, price) {
        this.tradeMarkers.push({ candleIndex, type, price });
    }

    drawChart(candles, positions) {
        if (!candles.length) return;

        const ctx = this.chartCtx;
        const w = this.chartWidth;
        const h = this.chartHeight;

        ctx.clearRect(0, 0, w, h);

        const visible = candles.slice(-this.maxVisibleCandles);
        const startIndex = Math.max(0, candles.length - this.maxVisibleCandles);

        let minPrice = Infinity, maxPrice = -Infinity;
        for (const c of visible) {
            if (c.low < minPrice) minPrice = c.low;
            if (c.high > maxPrice) maxPrice = c.high;
        }

        if (positions && positions.length > 0) {
            for (const p of positions) {
                if (p.openPrice < minPrice) minPrice = p.openPrice;
                if (p.openPrice > maxPrice) maxPrice = p.openPrice;
            }
        }

        const padding = (maxPrice - minPrice) * 0.1 || 1;
        minPrice -= padding;
        maxPrice += padding;

        const priceRange = maxPrice - minPrice;
        const priceToY = (price) => h - ((price - minPrice) / priceRange) * (h - 20) - 10;

        this._drawGrid(ctx, w, h, minPrice, maxPrice, priceRange);

        const cw = this.candleWidth;
        const gap = this.candleGap;

        for (let i = 0; i < visible.length; i++) {
            const c = visible[i];
            const x = i * (cw + gap) + gap;
            const isBullish = c.close >= c.open;

            const bodyTop = priceToY(Math.max(c.open, c.close));
            const bodyBottom = priceToY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

            const color = isBullish ? '#00c853' : '#f44336';
            const wickColor = isBullish ? '#00c85380' : '#f4433680';

            ctx.strokeStyle = wickColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + cw / 2, priceToY(c.high));
            ctx.lineTo(x + cw / 2, priceToY(c.low));
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.fillRect(x, bodyTop, cw, bodyHeight);
        }

        if (positions && positions.length > 0) {
            for (const pos of positions) {
                const y = priceToY(pos.openPrice);
                const color = pos.type === 'buy' ? '#00c853' : '#f44336';

                ctx.strokeStyle = color + '60';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = color;
                ctx.font = '10px monospace';
                const label = `${pos.type.toUpperCase()} ${pos.lots} @ ${pos.openPrice.toFixed(2)} (${pos.pl >= 0 ? '+' : ''}${pos.pl.toFixed(2)})`;
                ctx.fillText(label, 5, y - 4);
            }
        }

        const visibleMarkers = this.tradeMarkers.filter(
            m => m.candleIndex >= startIndex && m.candleIndex < startIndex + visible.length
        );

        for (const marker of visibleMarkers) {
            const i = marker.candleIndex - startIndex;
            const x = i * (cw + gap) + gap + cw / 2;
            const y = priceToY(marker.price);

            if (marker.type === 'buy_open') {
                this._drawArrowUp(ctx, x, y, '#00c853');
            } else if (marker.type === 'sell_open') {
                this._drawArrowDown(ctx, x, y, '#f44336');
            } else if (marker.type === 'close_profit') {
                this._drawX(ctx, x, y, '#ffd700');
            } else if (marker.type === 'close_loss') {
                this._drawX(ctx, x, y, '#ff6b6b');
            }
        }

        const lastCandle = visible[visible.length - 1];
        const lastY = priceToY(lastCandle.close);
        ctx.fillStyle = lastCandle.close >= lastCandle.open ? '#00c853' : '#f44336';
        ctx.fillRect(w - 75, lastY - 8, 75, 16);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lastCandle.close.toFixed(2), w - 37, lastY + 4);
        ctx.textAlign = 'left';

        this._drawVolume(visible);
    }

    _drawGrid(ctx, w, h, minPrice, maxPrice, priceRange) {
        ctx.strokeStyle = '#1e2a3a';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#555';
        ctx.font = '9px monospace';

        const steps = 6;
        for (let i = 0; i <= steps; i++) {
            const y = 10 + (i / steps) * (h - 20);
            const price = maxPrice - (i / steps) * priceRange;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w - 80, y);
            ctx.stroke();

            ctx.fillText(price.toFixed(2), w - 75, y + 3);
        }
    }

    _drawVolume(candles) {
        const ctx = this.volumeCtx;
        const w = this.chartWidth;
        const h = this.volumeHeight;

        ctx.clearRect(0, 0, w, h);

        let maxVol = 0;
        for (const c of candles) {
            if (c.volume > maxVol) maxVol = c.volume;
        }

        const cw = this.candleWidth;
        const gap = this.candleGap;

        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const x = i * (cw + gap) + gap;
            const barH = (c.volume / maxVol) * (h - 4);
            const isBullish = c.close >= c.open;

            ctx.fillStyle = isBullish ? '#00c85340' : '#f4433640';
            ctx.fillRect(x, h - barH, cw, barH);
        }
    }

    drawEquity(equityHistory, initialBalance) {
        const ctx = this.equityCtx;
        const w = this.equityWidth || 400;
        const h = this.equityHeight || 100;

        ctx.clearRect(0, 0, w, h);

        if (equityHistory.length < 2) return;

        const visible = equityHistory.slice(-300);

        let minEq = Infinity, maxEq = -Infinity;
        for (const v of visible) {
            if (v < minEq) minEq = v;
            if (v > maxEq) maxEq = v;
        }

        const pad = (maxEq - minEq) * 0.1 || 100;
        minEq -= pad;
        maxEq += pad;
        const range = maxEq - minEq;

        ctx.strokeStyle = '#ffd70030';
        ctx.lineWidth = 0.5;
        const baseY = h - ((initialBalance - minEq) / range) * h;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(w, baseY);
        ctx.stroke();

        ctx.fillStyle = '#555';
        ctx.font = '9px monospace';
        ctx.fillText('Base: $' + initialBalance.toLocaleString(), 4, baseY - 4);

        const step = w / (visible.length - 1);

        ctx.beginPath();
        for (let i = 0; i < visible.length; i++) {
            const x = i * step;
            const y = h - ((visible[i] - minEq) / range) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        const lastVal = visible[visible.length - 1];
        const color = lastVal >= initialBalance ? '#00c853' : '#f44336';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = color + '15';
        ctx.fill();

        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        const lastY = h - ((lastVal - minEq) / range) * h;
        ctx.fillText('$' + lastVal.toFixed(0), w - 70, lastY - 6);
    }

    _drawArrowUp(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.closePath();
        ctx.fill();
    }

    _drawArrowDown(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.closePath();
        ctx.fill();
    }

    _drawX(ctx, x, y, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
    }

    clear() {
        this.chartCtx.clearRect(0, 0, this.chartWidth, this.chartHeight);
        this.volumeCtx.clearRect(0, 0, this.chartWidth, this.volumeHeight);
        this.equityCtx.clearRect(0, 0, this.equityWidth || 400, this.equityHeight || 100);
        this.tradeMarkers = [];
    }
}
