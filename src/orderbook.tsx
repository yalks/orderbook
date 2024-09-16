import React, { useState, useMemo, useCallback } from "react";
import { useBinanceOrderBook } from "./useBinanceOrderBook";

const MAX_ORDERS = 20;

interface RawOrderBookEntry {
  price: number;
  quantity: number;
}

interface OrderBookEntry extends RawOrderBookEntry {
  volumePercentage: number;
  cumulativeQuantity: number;
}

const OrderBook: React.FC = () => {
  const [groupSize, setGroupSize] = useState<number>(0.0001);
  const { orderBook, loading, error } = useBinanceOrderBook();

  const groupedOrderBook = useMemo(() => {
    const groupOrders = (
      orders: RawOrderBookEntry[],
      isAsk: boolean
    ): RawOrderBookEntry[] => {
      const grouped: Record<string, number> = {};
      orders.forEach(({ price, quantity }) => {
        const groupedPrice = isAsk
          ? Math.ceil(price / groupSize) * groupSize
          : Math.floor(price / groupSize) * groupSize;
        const key = groupedPrice.toFixed(2);
        grouped[key] = (grouped[key] || 0) + quantity;
      });

      const ob = Object.entries(grouped).map(([price, quantity]) => ({
        price: parseFloat(price),
        quantity,
      }));

      if (isAsk) {
        return ob.sort((a, b) => a.price - b.price).slice(0, MAX_ORDERS);
      }
      return ob.sort((a, b) => b.price - a.price).slice(0, MAX_ORDERS);
    };

    const calculateVolumePercentage = (
      orders: RawOrderBookEntry[],
      isAsk: boolean
    ): OrderBookEntry[] => {
      const totalVolume = orders.reduce(
        (sum, order) => sum + order.quantity,
        0
      );
      let cumulativeQuantity = 0;

      if (isAsk) {
        // For asks, we accumulate from the end (highest price to lowest)
        return orders
          .reverse()
          .map((order, index, array) => {
            cumulativeQuantity += order.quantity;
            return {
              ...order,
              volumePercentage: (cumulativeQuantity / totalVolume) * 100,
              cumulativeQuantity,
            };
          })
          .reverse(); // Reverse back to maintain original order
      } else {
        // For bids, we accumulate from the start (highest price to lowest)
        return orders.map((order) => {
          cumulativeQuantity += order.quantity;
          return {
            ...order,
            volumePercentage: (cumulativeQuantity / totalVolume) * 100,
            cumulativeQuantity,
          };
        });
      }
    };

    const bids = groupOrders(orderBook.bids, false);
    const asks = groupOrders(orderBook.asks, true);

    return {
      bids: calculateVolumePercentage(bids, false),
      asks: calculateVolumePercentage(asks, true),
    };
  }, [orderBook, groupSize]);

  const renderOrderList = useCallback(
    (orders: OrderBookEntry[], title: string, isAsk: boolean) => (
      <div className="w-1/2">
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <ul>
          {orders.map((entry) => (
            <li
              key={entry.price}
              className="flex justify-between items-center mb-1"
            >
              <span
                className={`font-mono ${
                  isAsk ? "text-red-500" : "text-green-500"
                }`}
              >
                {entry.price.toFixed(2)}
              </span>
              <span className="mx-2 text-gray-400">|</span>
              <span className="font-mono">{entry.quantity.toFixed(5)}</span>
              <span className="mx-2 text-gray-400">|</span>
              <span className="font-mono">
                {entry.cumulativeQuantity.toFixed(5)}
              </span>
              <span className="mx-2 text-gray-400">|</span>
              <span className="font-mono text-xs text-gray-500 w-16 text-right">
                {entry.volumePercentage.toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    ),
    []
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">BNB/BTC Order Book</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <div className="mb-4">
        <label htmlFor="groupSize" className="mr-2">
          Group Size:
        </label>
        <select
          id="groupSize"
          value={groupSize}
          onChange={(e) => setGroupSize(parseFloat(e.target.value))}
          className="p-2 border rounded"
        >
          {[0.01, 0.1, 1, 10, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex">
        {renderOrderList(groupedOrderBook.asks, "Asks", true)}
        {renderOrderList(groupedOrderBook.bids, "Bids", false)}
      </div>
    </div>
  );
};

export default OrderBook;
