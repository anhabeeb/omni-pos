import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { db, uuid } from '../services/db';
import { Order, OrderStatus, KitchenStatus, Transaction } from '../types';
import { Clock, CheckCircle, Bell, Loader, Check, XCircle, AlertTriangle, ChefHat, Loader2 } from 'lucide-react';

export default function KOT() {
  const { user, currentStoreId, hasPermission } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());
  
  // Cancellation State
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadOrders = async () => {
    if (currentStoreId) {
      const allOrders = await db.getOrders(currentStoreId);
      // Filter by Kitchen Status (Not SERVED)
      const activeKitchenOrders = allOrders.filter(o => 
        o.kitchenStatus !== 'SERVED'
      );
      setOrders(activeKitchenOrders.sort((a, b) => a.createdAt - b.createdAt));
    }
  };

  useEffect(() => {
    loadOrders();
    const handleUpdate = () => loadOrders();
    if (currentStoreId) {
      window.addEventListener(`db_change_store_${currentStoreId}_orders`, handleUpdate);
    }
    return () => {
      if (currentStoreId) {
        window.removeEventListener(`db_change_store_${currentStoreId}_orders`, handleUpdate);
      }
    };
  }, [currentStoreId]);

  const updateKitchenStatus = async (order: Order, newKitchenStatus: KitchenStatus) => {
    if (!hasPermission('PROCESS_KOT')) {
        alert("Permission denied. You cannot update order status.");
        return;
    }
    if (processingOrderIds.has(order.id)) return;

    if (currentStoreId) {
      setProcessingOrderIds(prev => new Set(prev).add(order.id));
      try {
          const updates: Partial<Order> = { kitchenStatus: newKitchenStatus };
          if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED) {
              if (newKitchenStatus === 'PREPARING') updates.status = OrderStatus.PREPARING;
              if (newKitchenStatus === 'READY') updates.status = OrderStatus.READY;
          }
          await db.updateOrder(currentStoreId, { ...order, ...updates });
      } finally {
          setProcessingOrderIds(prev => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
          });
      }
    }
  };

  const handleCancel = async () => {
      if (!hasPermission('PROCESS_KOT')) {
          alert("Permission denied. You cannot cancel orders.");
          return;
      }
      if (currentStoreId && cancelOrder && user) {
          if (!cancelReason.trim()) {
              alert("Please provide a reason.");
              return;
          }
          
          const orderId = cancelOrder.id;
          setProcessingOrderIds(prev => new Set(prev).add(orderId));
          setCancelOrder(null); // Optimistic close modal
          
          try {
              const transaction: Transaction = {
                  id: uuid(),
                  type: 'CANCELLATION',
                  amount: cancelOrder.total,
                  timestamp: Date.now(),
                  performedBy: user.id,
                  note: `Kitchen Rejection: ${cancelReason}`
              };
              const updatedOrder: Order = {
                  ...cancelOrder,
                  status: OrderStatus.CANCELLED,
                  kitchenStatus: 'SERVED',
                  transactions: [...(cancelOrder.transactions || []), transaction],
                  cancellationReason: cancelReason
              };
              await db.updateOrder(currentStoreId, updatedOrder);
              setCancelReason('');
          } finally {
              setProcessingOrderIds(prev => {
                  const next = new Set(prev);
                  next.delete(orderId);
                  return next;
              });
          }
      }
  };

  const getStatusColor = (status: KitchenStatus, orderStatus: OrderStatus) => {
      if (orderStatus === OrderStatus.CANCELLED) return 'border-l-red-500 bg-red-50';
      switch(status) {
          case 'PENDING': return 'border-l-blue-500';
          case 'PREPARING': return 'border-l-orange-500 bg-orange-50';
          case 'READY': return 'border-l-green-500 bg-green-50';
          default: return 'border-l-gray-300';
      }
  };

  const canProcess = hasPermission('PROCESS_KOT');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><ChefHat size={28} className="text-orange-600"/> Kitchen Display System</h1>
          <p className="text-gray-500">Manage incoming orders and preparation status.</p>
        </div>
        <div className="text-sm bg-white px-3 py-1 rounded-full border shadow-sm">
            <span className="font-bold text-gray-700">{orders.length}</span> Active Orders
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-20 text-gray-400 bg-white rounded-xl border border-dashed">
                <Bell size={48} className="mb-4 opacity-50" />
                <p>No active orders. Waiting for new tickets...</p>
            </div>
        )}

        {orders.map(order => {
          const kitchenStatusVal = order.kitchenStatus;
          const currentStatus: KitchenStatus = (kitchenStatusVal && kitchenStatusVal !== undefined) ? kitchenStatusVal : 'PENDING';
          const cardStyle = getStatusColor(currentStatus, order.status);
          const isProcessing = processingOrderIds.has(order.id);

          return (
            <div key={order.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 flex flex-col relative ${cardStyle} ${isProcessing ? 'opacity-70 grayscale-[0.5]' : ''}`}>
              <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                  <div>
                      <h3 className="font-bold text-lg text-gray-800">#{order.orderNumber}</h3>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} /> {new Date(order.createdAt).toLocaleTimeString()}
                      </div>
                  </div>
                  <div className="text-right">
                      <span className="block text-xs font-bold uppercase text-gray-500">{order.orderType}</span>
                      {order.tableNumber && <span className="block text-xs font-bold bg-blue-100 text-blue-700 px-1 rounded mt-1">T-{order.tableNumber}</span>}
                  </div>
              </div>

              <div className="flex-1 space-y-2 mb-4 overflow-y-auto max-h-60">
                  {order.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 text-sm">
                          <span className="font-bold text-gray-800 w-6">{item.quantity}x</span>
                          <span className="text-gray-700">{item.productName}</span>
                      </div>
                  ))}
                  {order.note && (
                      <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded mt-2 border border-yellow-200">
                          <strong>Note:</strong> {order.note}
                      </div>
                  )}
              </div>

              <div className="mt-auto pt-2 border-t border-gray-100 flex flex-col gap-2">
                  {order.status === OrderStatus.CANCELLED ? (
                      <div className="text-center">
                          <div className="text-red-600 font-bold mb-2">CANCELLED</div>
                          <button 
                              onClick={() => updateKitchenStatus(order, 'SERVED')}
                              disabled={!canProcess || isProcessing}
                              className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isProcessing && <Loader2 className="animate-spin" size={14} />}
                              Dismiss
                          </button>
                      </div>
                  ) : (
                      <>
                          <div className="flex gap-2">
                              {currentStatus === 'PENDING' && (
                                  <button 
                                      onClick={() => updateKitchenStatus(order, 'PREPARING')}
                                      disabled={!canProcess || isProcessing}
                                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                      {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Loader size={16} />}
                                      Start
                                  </button>
                              )}
                              {currentStatus === 'PREPARING' && (
                                  <button 
                                      onClick={() => updateKitchenStatus(order, 'READY')}
                                      disabled={!canProcess || isProcessing}
                                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                      {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                      Ready
                                  </button>
                              )}
                              {currentStatus === 'READY' && (
                                  <button 
                                      onClick={() => updateKitchenStatus(order, 'SERVED')}
                                      disabled={!canProcess || isProcessing}
                                      className="flex-1 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                      {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                      Serve
                                  </button>
                              )}
                          </div>
                          {(currentStatus === 'PENDING' || currentStatus === 'PREPARING') && (
                              <button 
                                  onClick={() => setCancelOrder(order)}
                                  disabled={!canProcess || isProcessing}
                                  className="w-full py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                              >
                                  Reject / Cancel
                              </button>
                          )}
                      </>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {cancelOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
                  <h2 className="text-lg font-bold mb-4 text-red-600 flex items-center gap-2">
                      <AlertTriangle size={20}/> Reject Order #{cancelOrder.orderNumber}
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancelling this order.</p>
                  <textarea 
                      autoFocus
                      className="w-full p-2 border rounded-lg mb-4 text-sm"
                      placeholder="e.g. Out of stock..."
                      rows={3}
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setCancelOrder(null)} className="px-4 py-2 text-gray-600 text-sm">Back</button>
                      <button onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">Confirm Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}