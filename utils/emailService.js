const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendEmail(to, subject, html, text = '') {
    try {
      const mailOptions = {
        from: `"FarmDirect" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to FarmDirect!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Welcome to FarmDirect, ${user.name}!</h2>
        <p>Thank you for joining our community of farmers and customers.</p>
        <p>With FarmDirect, you can:</p>
        <ul>
          <li>Buy fresh produce directly from local farmers</li>
          <li>Support sustainable agriculture</li>
          <li>Get the best prices without middlemen</li>
          <li>Track your orders from farm to table</li>
        </ul>
        <p>Please verify your email address to get started:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email/${user.emailVerificationToken}" 
           style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Verify Email
        </a>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>The FarmDirect Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // Send order confirmation email
  async sendOrderConfirmationEmail(user, order) {
    const subject = `Order Confirmation - ${order.orderNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Order Confirmed!</h2>
        <p>Dear ${user.name},</p>
        <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
        <h3>Order Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 10px; text-align: left;">Product</th>
            <th style="padding: 10px; text-align: left;">Quantity</th>
            <th style="padding: 10px; text-align: left;">Price</th>
          </tr>
          ${order.items.map(item => `
            <tr>
              <td style="padding: 10px;">${item.name}</td>
              <td style="padding: 10px;">${item.quantity} ${item.unit}</td>
              <td style="padding: 10px;">₹${item.price}</td>
            </tr>
          `).join('')}
        </table>
        <p><strong>Total Amount: ₹${order.finalAmount}</strong></p>
        <p>Delivery Address: ${order.deliveryAddress.street}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}</p>
        <p>Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString()}</p>
        <p>You can track your order here: <a href="${process.env.FRONTEND_URL}/orders/${order._id}">Track Order</a></p>
        <p>Thank you for choosing FarmDirect!</p>
        <p>Best regards,<br>The FarmDirect Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset for your FarmDirect account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}" 
           style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The FarmDirect Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // Send farmer approval email
  async sendFarmerApprovalEmail(user) {
    const subject = 'Your Farmer Account Has Been Approved!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Congratulations!</h2>
        <p>Dear ${user.name},</p>
        <p>Your farmer account has been approved by the FarmDirect team.</p>
        <p>You can now:</p>
        <ul>
          <li>Add your farm products to our marketplace</li>
          <li>Manage your inventory</li>
          <li>Receive and process orders</li>
          <li>Track your earnings</li>
        </ul>
        <p>Get started by adding your first product: <a href="${process.env.FRONTEND_URL}/farmer/products">Add Products</a></p>
        <p>Welcome to the FarmDirect farming community!</p>
        <p>Best regards,<br>The FarmDirect Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  // Send order status update email
  async sendOrderStatusEmail(user, order, status) {
    const statusMessages = {
      'confirmed': 'Your order has been confirmed by the farmer(s)',
      'shipped': 'Your order has been shipped and is on its way',
      'out-for-delivery': 'Your order is out for delivery',
      'delivered': 'Your order has been delivered successfully'
    };

    const subject = `Order Update - ${order.orderNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Order Status Update</h2>
        <p>Dear ${user.name},</p>
        <p>${statusMessages[status] || `Your order status has been updated to: ${status}`}</p>
        <p>Order Number: <strong>${order.orderNumber}</strong></p>
        <p>Track your order here: <a href="${process.env.FRONTEND_URL}/orders/${order._id}">Track Order</a></p>
        <p>Thank you for choosing FarmDirect!</p>
        <p>Best regards,<br>The FarmDirect Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }
}

module.exports = new EmailService();
