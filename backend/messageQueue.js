class MessageQueue {
  constructor(database) {
    this.db = database;
  }

  async queueForOfflineDelivery(message, recipientId, eventType = 'private_message') {
    await this.db.upsertDeliveryStatus(message.id, recipientId, 'sent');
    await this.db.queueMessage(message.id, recipientId, eventType);
    return true;
  }

  async deliverQueuedMessages(userId, socket, io, context = {}) {
    const queuedMessages = await this.db.getQueuedMessages(userId);
    const delivered = [];

    for (const queued of queuedMessages) {
      try {
        const message = await this.db.getMessage(queued.message_id);
        if (!message) {
          await this.db.removeFromQueue(queued.message_id, userId);
          continue;
        }

        const eventType = queued.event_type || (message.groupId ? 'group_message' : 'private_message');
        socket.emit(eventType, message);

        const updatedMessage = await this.db.markMessageDelivered(message.id, userId, Date.now());
        await this.db.removeFromQueue(message.id, userId);

        if (eventType === 'private_message' && updatedMessage?.from && context.userSocketMap?.has(updatedMessage.from)) {
          io.to(context.userSocketMap.get(updatedMessage.from)).emit('message_delivered', {
            messageId: updatedMessage.id,
            status: 'delivered',
            timestamp: updatedMessage.deliveredAt,
          });
        }

        delivered.push(updatedMessage || message);
      } catch (error) {
        console.error(`Failed to deliver queued message ${queued.message_id}:`, error);
        await this.db.incrementQueueAttempts(queued.message_id, userId);
      }
    }

    return delivered;
  }

  async sendGroupMessage(message, groupMembers, onlineUserMap, io) {
    const deliveredTo = [];
    const queuedFor = [];

    for (const memberId of groupMembers) {
      if (memberId === message.from) {
        continue;
      }

      const recipientSocketId = onlineUserMap.get(memberId);
      if (recipientSocketId) {
        const deliveredMessage = await this.db.markMessageDelivered(message.id, memberId, Date.now());
        io.to(recipientSocketId).emit('group_message', deliveredMessage || { ...message, status: 'delivered' });
        deliveredTo.push(memberId);
      } else {
        await this.queueForOfflineDelivery(message, memberId, 'group_message');
        queuedFor.push(memberId);
      }
    }

    return { deliveredTo, queuedFor };
  }
}

module.exports = MessageQueue;
