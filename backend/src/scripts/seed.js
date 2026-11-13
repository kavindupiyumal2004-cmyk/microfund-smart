require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, User, Area, AgentArea, LoanType, CashierProfile } = require('../models');

(async () => {
  try {
    await sequelize.sync({ alter: true });
    const roles = {};
    for (const name of ['OWNER', 'MANAGER', 'AGENT', 'CASHIER', 'CUSTOMER']) {
      const [role] = await Role.findOrCreate({ where: { name } });
      roles[name] = role;
    }
    const areaRows = [
      { name: 'Peradeniya', district: 'Kandy', province: 'Central' },
      { name: 'Katugastota', district: 'Kandy', province: 'Central' },
      { name: 'Gampola', district: 'Kandy', province: 'Central' },
      { name: 'Maharagama', district: 'Colombo', province: 'Western' },
      { name: 'Nugegoda', district: 'Colombo', province: 'Western' },
    ];
    const areas = [];
    for (const item of areaRows) {
      const [area] = await Area.findOrCreate({ where: { name: item.name, district: item.district }, defaults: item });
      areas.push(area);
    }
    const password = await bcrypt.hash('Password@123', 12);
    const seedUsers = [
      { full_name: 'MicroFund Owner', email: 'owner@microfund.local', role: 'OWNER' },
      { full_name: 'Operations Manager', email: 'manager@microfund.local', role: 'MANAGER' },
      { full_name: 'Main Cashier', email: 'cashier@microfund.local', role: 'CASHIER', branch: 'Colombo Main Branch' },
      { full_name: 'Kandy Cashier', email: 'cashier2@microfund.local', role: 'CASHIER', branch: 'Kandy Branch' },
      { full_name: 'Kasun Agent', email: 'agent@microfund.local', role: 'AGENT' },
    ];
    let agent;
    for (const item of seedUsers) {
      const [user] = await User.findOrCreate({
        where: { email: item.email },
        defaults: { full_name: item.full_name, password_hash: password, role_id: roles[item.role].id, email_verified_at: new Date(), is_active: true },
      });
      if (user.role_id !== roles[item.role].id) await user.update({ role_id: roles[item.role].id });
      if (item.role === 'AGENT') agent = user;
      if (item.role === 'CASHIER') await CashierProfile.findOrCreate({ where: { user_id: user.id }, defaults: { branch_name: item.branch, is_available: true, max_pending_reviews: 50 } });
    }
    if (agent) await AgentArea.bulkCreate(areas.slice(0, 3).map((area) => ({ user_id: agent.id, area_id: area.id })), { ignoreDuplicates: true });
    const loanTypes = [
      { name: 'Small Business Loan', description: 'Working capital for micro and small businesses.', min_amount: 25000, max_amount: 500000, annual_interest_rate: 12, duration_months: 12 },
      { name: 'Agriculture Loan', description: 'Seasonal and equipment finance for agriculture.', min_amount: 20000, max_amount: 300000, annual_interest_rate: 10, duration_months: 10 },
      { name: 'Education Support Loan', description: 'Education and professional training expenses.', min_amount: 15000, max_amount: 250000, annual_interest_rate: 8, duration_months: 12 },
    ];
    for (const item of loanTypes) await LoanType.findOrCreate({ where: { name: item.name }, defaults: item });
    console.log('Seed completed. Password for seeded users: Password@123');
    console.log('Owner: owner@microfund.local | Manager: manager@microfund.local | Agent: agent@microfund.local | Cashier: cashier@microfund.local');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
