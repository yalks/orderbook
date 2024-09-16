import { useState, useEffect, useRef, useCallback } from 'react';

interface OrderBookEntry {
    price: number;
    quantity: number;
}

interface OrderBook {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
    lastUpdateId: number;
}

interface DepthUpdate {
    e: string; // Event type
    E: number; // Event time
    s: string; // Symbol
    U: number; // First update ID in event
    u: number; // Final update ID in event
    b: [string, string][]; // Bids to be updated
    a: [string, string][]; // Asks to be updated
}

const WS_URL = 'wss://stream.cexyes.com';
// const REST_URL = 'https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=1000';
const REST_URL = 'https://b.cexyes.com/api/spot/depth/BTCUSDT';

export function useBinanceOrderBook() {
    const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [], lastUpdateId: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const ws = useRef<WebSocket | null>(null);
    const bufferRef = useRef<DepthUpdate[]>([]);
    const lastUpdateIdRef = useRef<number>(0);

    const updateLocalOrderBook = useCallback((update: DepthUpdate) => {
        setOrderBook(prevOrderBook => {
            const newOrderBook = { ...prevOrderBook };

            const updateSide = (side: 'bids' | 'asks', updates: [string, string][]) => {
                updates.forEach(([price, quantity]) => {
                    const priceNum = parseFloat(price);
                    const quantityNum = parseFloat(quantity);
                    const index = newOrderBook[side].findIndex(entry => entry.price === priceNum);

                    if (quantityNum === 0) {
                        if (index !== -1) {
                            newOrderBook[side].splice(index, 1);
                        }
                    } else {
                        if (index !== -1) {
                            newOrderBook[side][index].quantity = quantityNum;
                        } else {
                            newOrderBook[side].push({ price: priceNum, quantity: quantityNum });
                        }
                        newOrderBook[side].sort((a, b) => side === 'bids' ? b.price - a.price : a.price - b.price);
                    }
                });
            };

            updateSide('bids', update.b);
            updateSide('asks', update.a);

            newOrderBook.lastUpdateId = update.u;

            return newOrderBook;
        });
    }, []);

    const processBufferedUpdates = useCallback(() => {
        while (bufferRef.current.length > 0) {
            const update = bufferRef.current[0];
            updateLocalOrderBook(update);
            lastUpdateIdRef.current = update.u;
            bufferRef.current.shift();
            // return
            // if (update.U <= lastUpdateIdRef.current + 1 && update.u >= lastUpdateIdRef.current + 1) {
            //     updateLocalOrderBook(update);
            //     lastUpdateIdRef.current = update.u;
            //     bufferRef.current.shift();
            // } else if (update.U > lastUpdateIdRef.current + 1) {
            //     break; // Wait for the next update
            // } else {
            //     bufferRef.current.shift(); // Discard this update
            // }
        }
    }, [updateLocalOrderBook]);

    const initializeOrderBook = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(REST_URL);
            const jsondata = await response.json();
            const data = jsondata?.data;
            if (!data) {
                return;
            }

            const newOrderBook: OrderBook = {
                bids: data.bids.map(([price, quantity]: [string, string]) => ({
                    price: parseFloat(price),
                    quantity: parseFloat(quantity)
                })),
                asks: data.asks.map(([price, quantity]: [string, string]) => ({
                    price: parseFloat(price),
                    quantity: parseFloat(quantity)
                })),
                lastUpdateId: data.lastUpdateId
            };

            setOrderBook(newOrderBook);
            lastUpdateIdRef.current = data.lastUpdateId;

            // Process any buffered updates
            bufferRef.current = bufferRef.current.filter(update => update.u >= data.lastUpdateId);
            processBufferedUpdates();

            setLoading(false);
        } catch (err) {
            setError('Failed to fetch order book snapshot');
            setLoading(false);
        }
    }, [processBufferedUpdates]);

    useEffect(() => {
        const connectWebSocket = (id = 0) => {

            ws.current = new WebSocket(WS_URL);

            ws.current.onopen = () => {
                console.log('WebSocket connected');
                initializeOrderBook();
                //发送订阅消息
                if (ws.current) {
                    ws.current.send('{"sub":["BTCUSDT@depth"]}');
                };
            };

            ws.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.data) {
                    const update: DepthUpdate = data.data;
                    bufferRef.current.push(update);
                    processBufferedUpdates();
                }

            };

            ws.current.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('WebSocket error occurred');
            };

            ws.current.onclose = () => {
                console.log('WebSocket disconnected');
                // setTimeout(connectWebSocket, 5000);
            };
        };

        connectWebSocket();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [initializeOrderBook, processBufferedUpdates]);

    return { orderBook, loading, error };
}