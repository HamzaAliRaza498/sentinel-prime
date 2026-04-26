const bcrypt = require('bcryptjs');

async function createUser() {
    const { sequelize } = require('./src/config/database');
    const { User } = require('./src/models');
    
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');
        
        // Hash the password properly
        const plainPassword = 'abcd';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        console.log('Password hash created');
        
        // Create user
        const user = await User.create({
            username: 'testuser',
            email: 'test@sentinel.com',
            password_hash: hashedPassword,
            role: 'officer'
        });
        
        console.log('✅ User created successfully!');
        console.log('📧 Email: test@sentinel.com');
        console.log('🔑 Password: plm');
        console.log('👤 Role: officer');
        
        await sequelize.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('duplicate')) {
            console.log('User already exists! Try a different email.');
        }
        await sequelize.close();
    }
}

createUser();