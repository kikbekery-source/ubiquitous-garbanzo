class EAEngine {
    constructor(config) {
        this.config = {
            strategy: config.strategy || 'grid_martingale',
            balance: config.balance || 100000,
            lotSize: config.lotSize || 0.01,
            gridDistance: config.gridDistance || 500,
            martingaleMultiplier: config.martingaleMultiplier || 2.0,
            maxLevels: config.maxLevels || 8,
            takeProfit: config.takeProfit || 100,
            stopLoss: config.stopLoss || 0,
            leverage: 500,
        };
        this.reset();
    }

    reset() {
        this.balance = this.config.balance;
        this.equity = this.config.balance;
        this.positions = [];
        this.closedTrades = [];
        this.tradeIdCounter = 1;
        this.lastGridPrice = null;
        this.recoveryLevel = 0;
        this.maxRecoveryLevel = 0;
        this.peakEquity = this.config.balance;
        this.maxDrawdown = 0;
        this.totalProfit = 0;
        this.totalLoss = 0;
        this.marginCallTriggered = false;
        this.equityHistory = [this.config.balance];
        this.initialDirection = null;
    }

    onNewCandle(candle, priceEngine) {
        if (this.marginCallTriggered) return;

        const bid = priceEngine.getBid();
        const ask = priceEngine.getAsk();

        this._updateFloatingPL(bid, ask);
        this._checkMarginCall();

        if (this.marginCallTriggered) return;

        const strategies = {
            grid_martingale: () => this._gridMartingaleStrategy(candle, bid, ask),
            grid_fixed: () => this._gridFixedStrategy(candle, bid, ask),
            trend_follow: () => this._trendFollowStrategy(candle, bid, ask, priceEngine),
            mean_revert: () => this._meanRevertStrategy(candle, bid, ask, priceEngine),
        };

        const strategy = strategies[this.config.strategy];
        if (strategy) strategy();

        this._checkTakeProfit(bid, ask);
        this._checkStopLoss();

        this.equityHistory.push(this.equity);

        if (this.equity > this.peakEquity) {
            this.peakEquity = this.equity;
        }
        const dd = this.peakEquity - this.equity;
        if (dd > this.maxDrawdown) {
            this.maxDrawdown = dd;
        }
    }

    _gridMartingaleStrategy(candle, bid, ask) {
        if (this.positions.length === 0) {
            const direction = candle.close >= candle.open ? 'buy' : 'sell';
            this.initialDirection = direction;
            this._openPosition(direction, this.config.lotSize, direction === 'buy' ? ask : bid);
            this.lastGridPrice = candle.close;
            this.recoveryLevel = 0;
            return;
        }

        const priceDiff = Math.abs(candle.close - this.lastGridPrice) * 100;

        if (priceDiff >= this.config.gridDistance) {
            const floatingPL = this._getFloatingPL(bid, ask);

            if (floatingPL < 0 && this.recoveryLevel < this.config.maxLevels) {
                this.recoveryLevel++;
                if (this.recoveryLevel > this.maxRecoveryLevel) {
                    this.maxRecoveryLevel = this.recoveryLevel;
                }

                const newLot = parseFloat(
                    (this.config.lotSize * Math.pow(this.config.martingaleMultiplier, this.recoveryLevel)).toFixed(2)
                );

                const firstPos = this.positions[0];
                const direction = firstPos.type;

                if (direction === 'buy' && candle.close < this.lastGridPrice) {
                    this._openPosition('buy', newLot, ask);
                    this.lastGridPrice = candle.close;
                } else if (direction === 'sell' && candle.close > this.lastGridPrice) {
                    this._openPosition('sell', newLot, bid);
                    this.lastGridPrice = candle.close;
                }
            }
        }
    }

    _gridFixedStrategy(candle, bid, ask) {
        if (this.positions.length === 0) {
            const direction = candle.close >= candle.open ? 'buy' : 'sell';
            this._openPosition(direction, this.config.lotSize, direction === 'buy' ? ask : bid);
            this.lastGridPrice = candle.close;
            return;
        }

        const priceDiff = Math.abs(candle.close - this.lastGridPrice) * 100;

        if (priceDiff >= this.config.gridDistance) {
            const floatingPL = this._getFloatingPL(bid, ask);
            if (floatingPL < 0 && this.positions.length < this.config.maxLevels) {
                const firstPos = this.positions[0];
                if (firstPos.type === 'buy' && candle.close < this.lastGridPrice) {
                    this._openPosition('buy', this.config.lotSize, ask);
                    this.lastGridPrice = candle.close;
                } else if (firstPos.type === 'sell' && candle.close > this.lastGridPrice) {
                    this._openPosition('sell', this.config.lotSize, bid);
                    this.lastGridPrice = candle.close;
                }
            }
        }
    }

    _trendFollowStrategy(candle, bid, ask, priceEngine) {
        const candles = priceEngine.candles;
        if (candles.length < 20) return;

        const ma10 = this._calcMA(candles, 10);
        const ma20 = this._calcMA(candles, 20);

        if (this.positions.length === 0) {
            if (ma10 > ma20) {
                this._openPosition('buy', this.config.lotSize, ask);
            } else if (ma10 < ma20) {
                this._openPosition('sell', this.config.lotSize, bid);
            }
        } else {
            const pos = this.positions[0];
            if (pos.type === 'buy' && ma10 < ma20) {
                this._closeAllPositions(bid, ask);
            } else if (pos.type === 'sell' && ma10 > ma20) {
                this._closeAllPositions(bid, ask);
            }
        }
    }

    _meanRevertStrategy(candle, bid, ask, priceEngine) {
        const candles = priceEngine.candles;
        if (candles.length < 20) return;

        const ma20 = this._calcMA(candles, 20);
        const deviation = candle.close - ma20;
        const threshold = 3.0;

        if (this.positions.length === 0) {
            if (deviation < -threshold) {
                this._openPosition('buy', this.config.lotSize, ask);
            } else if (deviation > threshold) {
                this._openPosition('sell', this.config.lotSize, bid);
            }
        } else {
            const floatingPL = this._getFloatingPL(bid, ask);
            if (floatingPL > 50) {
                this._closeAllPositions(bid, ask);
            }

            if (floatingPL < 0 && this.positions.length < this.config.maxLevels) {
                const priceDiff = Math.abs(candle.close - this.lastGridPrice) * 100;
                if (priceDiff >= this.config.gridDistance) {
                    const pos = this.positions[0];
                    const newLot = this.config.strategy === 'grid_martingale'
                        ? parseFloat((this.config.lotSize * Math.pow(this.config.martingaleMultiplier, this.positions.length)).toFixed(2))
                        : this.config.lotSize;

                    this._openPosition(pos.type, newLot, pos.type === 'buy' ? ask : bid);
                    this.lastGridPrice = candle.close;
                }
            }
        }
    }

    _calcMA(candles, period) {
        const slice = candles.slice(-period);
        return slice.reduce((sum, c) => sum + c.close, 0) / slice.length;
    }

    _openPosition(type, lots, price) {
        const marginRequired = lots * 100 * price / this.config.leverage;

        const pos = {
            id: this.tradeIdCounter++,
            type: type,
            lots: lots,
            openPrice: price,
            openTime: new Date(),
            margin: marginRequired,
            pl: 0,
        };

        this.positions.push(pos);
        if (!this.lastGridPrice) this.lastGridPrice = price;

        return pos;
    }

    _closePosition(pos, bid, ask) {
        const closePrice = pos.type === 'buy' ? bid : ask;
        const pips = pos.type === 'buy'
            ? (closePrice - pos.openPrice)
            : (pos.openPrice - closePrice);
        const pl = parseFloat((pips * pos.lots * 100).toFixed(2));

        this.balance += pl;
        if (pl >= 0) {
            this.totalProfit += pl;
        } else {
            this.totalLoss += Math.abs(pl);
        }

        this.closedTrades.push({
            id: pos.id,
            type: pos.type,
            lots: pos.lots,
            openPrice: pos.openPrice,
            closePrice: closePrice,
            pl: pl,
            closeTime: new Date(),
        });

        return pl;
    }

    _closeAllPositions(bid, ask) {
        let totalPL = 0;
        for (const pos of [...this.positions]) {
            totalPL += this._closePosition(pos, bid, ask);
        }
        this.positions = [];
        this.recoveryLevel = 0;
        this.lastGridPrice = null;
        return totalPL;
    }

    _checkTakeProfit(bid, ask) {
        if (this.config.takeProfit <= 0) return;

        const floatingPL = this._getFloatingPL(bid, ask);
        if (floatingPL >= this.config.takeProfit) {
            this._closeAllPositions(bid, ask);
        }
    }

    _checkStopLoss() {
        if (this.config.stopLoss <= 0) return;

        const loss = this.config.balance - this.equity;
        if (loss >= this.config.stopLoss) {
            this.marginCallTriggered = true;
        }
    }

    _checkMarginCall() {
        const totalMargin = this.positions.reduce((sum, p) => sum + p.margin, 0);
        if (totalMargin > 0) {
            const marginLevel = (this.equity / totalMargin) * 100;
            if (marginLevel < 50) {
                this.marginCallTriggered = true;
            }
        }
    }

    _updateFloatingPL(bid, ask) {
        let totalFloating = 0;
        for (const pos of this.positions) {
            const closePrice = pos.type === 'buy' ? bid : ask;
            const pips = pos.type === 'buy'
                ? (closePrice - pos.openPrice)
                : (pos.openPrice - closePrice);
            pos.pl = parseFloat((pips * pos.lots * 100).toFixed(2));
            totalFloating += pos.pl;
        }
        this.equity = parseFloat((this.balance + totalFloating).toFixed(2));
    }

    _getFloatingPL(bid, ask) {
        let total = 0;
        for (const pos of this.positions) {
            const closePrice = pos.type === 'buy' ? bid : ask;
            const pips = pos.type === 'buy'
                ? (closePrice - pos.openPrice)
                : (pos.openPrice - closePrice);
            total += pips * pos.lots * 100;
        }
        return parseFloat(total.toFixed(2));
    }

    getStats() {
        const totalTrades = this.closedTrades.length;
        const winTrades = this.closedTrades.filter(t => t.pl >= 0).length;
        const lossTrades = this.closedTrades.filter(t => t.pl < 0).length;
        const profitFactor = this.totalLoss > 0 ? (this.totalProfit / this.totalLoss) : 0;
        const totalMargin = this.positions.reduce((sum, p) => sum + p.margin, 0);
        const marginLevel = totalMargin > 0 ? (this.equity / totalMargin) * 100 : Infinity;
        const totalLots = this.positions.reduce((sum, p) => sum + p.lots, 0);
        const floatingPL = this.equity - this.balance;

        return {
            balance: this.balance,
            equity: this.equity,
            floatingPL: floatingPL,
            marginUsed: totalMargin,
            marginLevel: marginLevel,
            totalLots: totalLots,
            openPositions: this.positions.length,
            recoveryLevel: this.recoveryLevel,
            totalTrades: totalTrades,
            winTrades: winTrades,
            lossTrades: lossTrades,
            maxDrawdown: this.maxDrawdown,
            maxRecoveryLevel: this.maxRecoveryLevel,
            profitFactor: profitFactor,
            marginCallTriggered: this.marginCallTriggered,
        };
    }
}
