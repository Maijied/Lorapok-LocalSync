

class MessageQueue {
  constructor(database) {
    this.db = database;
    this.deliveryRetries = new Map(); // Track retry attempts per message
    this.maxRetries = 3;
    this.retryInterval = 5000; // 5 seconds between retries
  }

  /**
   * Queue a message for offline delivery
   */
  async queueForOfflineDelivery(messageData, recipientId) {
    try {
      // Create delivery status record
      await this.db.saveDeliveryStatus(messageData.id, recipientId, 'pending');

      // Add to queue
      await this.db.queueMessage(messageData.id, recipientId);

      console.log(`Message ${messageData.id} queued for user ${recipientId}`);
      return true;
    } catch (error) {
      console.error('Error queuing message:', error);
      return false;
    }
  }

  /**
   * Deliver queued messages when user comes online
   */
  async deliverQueuedMessages(userId, socket) {
    try {
      const queuedMessages = await this.db.getQueuedMessages(userId);

      if (queuedMessages.length === 0) {
        console.log(`No queued messages for user ${userId}`);
        return [];
      }

      const deliveredMessages = [];

      for (const queuedMsg of queuedMessages) {
        try {
          const message = await this.db.getMessage(queuedMsg.message_id);

          if (message) {
            // Send to user
            socket.emit('private_message', message);
            socket.emit('message_delivered', {
              messageId: message.id,
              status: 'delivered',
              timestamp: Date.now()
            });

            // Update delivery status
            await this.db.updateDeliveryStatus(message.id, userId, 'delivered', Date.now());

            // Remove from queue
            await this.db.removeFromQueue(message.id, userId);

            deliveredMessages.push(message);
            console.log(`Delivered queued message ${message.id} to user ${userId}`);
            
            // Small delay to prevent overwhelming the socket/UI
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error(`Error delivering queued message ${queuedMsg.message_id}:`, error);
          await this.db.incrementQueueAttempts(queuedMsg.message_id, userId);
        }
      }

      return deliveredMessages;
    } catch (error) {
      console.error('Error delivering queued messages:', error);
      return [];
    }
  }

  /**
   * Send message with retry logic
   */
  async sendMessageWithRetry(messageData, recipientId, recipientSocket, io) {
    try {
      if (recipientSocket) {
        // User is online - send immediately
        io.to(recipientSocket).emit('private_message', messageData);

        // Update status to delivered
        await this.db.updateMessageStatus(messageData.id, 'delivered');
        await this.db.saveDeliveryStatus(messageData.id, recipientId, 'delivered');

        return true;
      } else {
        // User is offline - queue for delivery
        await this.queueForOfflineDelivery(messageData, recipientId);
        return false;
      }
    } catch (error) {
      console.error('Error sending message with retry:', error);
      return false;
    }
  }

  /**
   * Send group message with offline tracking
   */
  async sendGroupMessage(messageData, groupMembers, connectedUsers, io, db) {
    const deliveryStatus = {
      messageId: messageData.id,
      delivered: [],
      queued: []
    };

    for (const memberId of groupMembers) {
      if (memberId === messageData.from) continue; // Skip sender

      const memberConnection = connectedUsers.get(memberId);

      if (memberConnection) {
        // User is online
        io.to(memberConnection).emit('group_message', messageData);
        deliveryStatus.delivered.push(memberId);
        await db.saveDeliveryStatus(messageData.id, memberId, 'delivered');
      } else {
        // User is offline - queue it
        await this.queueForOfflineDelivery(messageData, memberId);
        deliveryStatus.queued.push(memberId);
      }
    }

    return deliveryStatus;
  }

  /**
   * Retry failed deliveries periodically
   */
  async retryFailedDeliveries(db, io, connectedUsers) {
    try {
      const failedMessages = await db.all(
        `SELECT m.*, md.recipient_id FROM messages m
         INNER JOIN message_delivery md ON m.id = md.message_id
         WHERE md.status = 'pending' AND md.delivered_at IS NULL`
      );

      for (const msg of failedMessages) {
        const recipientSocket = connectedUsers.get(msg.recipient_id);

        if (recipientSocket) {
          try {
            io.to(recipientSocket).emit('private_message', {
              id: msg.id,
              from: msg.from_user_id,
              to: msg.to_user_id,
              text: msg.content,
              timestamp: msg.timestamp,
              status: msg.status
            });

            await db.updateDeliveryStatus(msg.id, msg.recipient_id, 'delivered', Date.now());
            console.log(`Retry: Delivered message ${msg.id} to user ${msg.recipient_id}`);
          } catch (error) {
            console.error(`Retry failed for message ${msg.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in retryFailedDeliveries:', error);
    }
  }

  /**
   * Clean up old queued messages (older than 30 days)
   */
  async cleanupOldMessages(db) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      await db.run(
        'DELETE FROM message_queue WHERE queued_at < ?',
        [thirtyDaysAgo]
      );

      console.log('Cleaned up old queued messages');
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
    }
  }
}

module.exports = MessageQueue;
