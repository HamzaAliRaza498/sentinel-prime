const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('officer', 'analyst', 'commander', 'admin'),
        defaultValue: 'analyst'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    two_factor_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Hash password before saving
User.beforeCreate(async (user) => {
    user.password_hash = await bcrypt.hash(user.password_hash, 10);
});

User.beforeUpdate(async (user) => {
    if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
    }
});

// Method to check password
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
};

module.exports = User;