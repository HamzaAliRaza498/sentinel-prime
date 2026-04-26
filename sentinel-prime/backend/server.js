const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Sequelize, DataTypes, Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============ POSTGRESQL CONNECTION ============
console.log("🔌 Connecting to PostgreSQL...");

const sequelize = new Sequelize(
    process.env.DB_NAME || "sentinel_prime_db",
    process.env.DB_USER || "postgres",
    process.env.DB_PASSWORD || "postgres",
    {
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 5432,
        dialect: "postgres",
        logging: false,
    }
);

// ============ USER MODEL ============
const User = sequelize.define("User", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), defaultValue: "public" },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    badge_number: { type: DataTypes.STRING(20), allowNull: true },
    department: { type: DataTypes.STRING(100), allowNull: true },
    rank: { type: DataTypes.STRING(50), allowNull: true }
}, { tableName: "users", timestamps: true });

// ============ OTP MODEL ============
const OTP = sequelize.define("OTP", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    otp_code: { type: DataTypes.STRING(6), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    is_used: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "otp_codes", timestamps: true });

// ============ ASSOCIATIONS ============
User.hasMany(OTP, { foreignKey: "user_id" });
OTP.belongsTo(User, { foreignKey: "user_id" });

// ============ HASH PASSWORD HOOK ============
User.beforeCreate(async (user) => {
    if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
    }
});

// ============ EMAIL CONFIGURATION ============
// Create email transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "your_email@gmail.com",
        pass: process.env.EMAIL_PASS || "your_app_password"
    }
});

// Function to send OTP email
const sendOTPEmail = async (email, otpCode, username) => {
    const mailOptions = {
        from: `"Prime Crime Intelligence" <${process.env.EMAIL_USER || "noreply@primecrime.com"}>`,
        to: email,
        subject: "🔐 Verify Your Email - Prime Crime Intelligence",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🛡️ Prime Crime Intelligence</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Hello ${username},</h2>
                    <p>Thank you for registering! Please verify your email address using the OTP below:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 5px;">
                        ${otpCode}
                    </div>
                    <p style="margin-top: 20px;">This OTP is valid for <strong>10 minutes</strong>.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">Prime Crime Intelligence - Secure Law Enforcement Platform</p>
                </div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email}`);
        console.log(`📧 OTP Code: ${otpCode} (for testing)`);
        return true;
    } catch (error) {
        console.error("❌ Email error:", error.message);
        return false;
    }
};

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT Token
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "secret_key",
        { expiresIn: "7d" }
    );
};

// ============ REGISTER - SEND OTP FIRST ============
app.post("/api/auth/register", async (req, res) => {
    const { username, email, password, role, badge_number, department, rank } = req.body;
    console.log("📝 Registration attempt:", email);
    
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }
        
        // Create user (inactive until OTP verified)
        const user = await User.create({
            username,
            email,
            password_hash: password,
            role: role || "public",
            is_active: false,
            is_verified: false,
            badge_number: badge_number || null,
            department: department || null,
            rank: rank || null
        });
        
        // Generate OTP
        const otpCode = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        
        // Save OTP to database
        await OTP.create({
            user_id: user.id,
            otp_code: otpCode,
            expires_at: expiresAt,
            is_used: false
        });
        
        // Send OTP via email
        const emailSent = await sendOTPEmail(email, otpCode, username);
        
        if (emailSent) {
            console.log(`✅ OTP sent to ${email}`);
            res.json({
                success: true,
                userId: user.id,
                message: "OTP sent to your email. Please verify to complete registration."
            });
        } else {
            // If email fails, still return OTP in response for testing
            console.log(`⚠️ Email failed. OTP for testing: ${otpCode}`);
            res.json({
                success: true,
                userId: user.id,
                message: `Registration pending. Use OTP: ${otpCode} (Email not configured)`
            });
        }
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============ VERIFY OTP AND ACTIVATE ACCOUNT ============
app.post("/api/auth/verify-otp", async (req, res) => {
    const { userId, otpCode } = req.body;
    console.log("📝 Verifying OTP for user:", userId);
    
    try {
        // Find valid OTP
        const otpRecord = await OTP.findOne({
            where: {
                user_id: userId,
                otp_code: otpCode,
                is_used: false,
                expires_at: { [Op.gt]: new Date() }
            }
        });
        
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        
        // Mark OTP as used
        await otpRecord.update({ is_used: true });
        
        // Activate user account
        const user = await User.findByPk(userId);
        if (user) {
            await user.update({ is_active: true, is_verified: true });
        }
        
        console.log("✅ OTP verified! Account activated for:", user?.email);
        res.json({ success: true, message: "Email verified successfully! You can now login." });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============ LOGIN - ONLY VERIFIED USERS ============
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    console.log("📝 Login attempt:", email);
    
    try {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        // Check if email is verified
        if (!user.is_verified) {
            return res.status(401).json({ success: false, message: "Please verify your email first. Check your inbox for OTP." });
        }
        
        if (!user.is_active) {
            return res.status(401).json({ success: false, message: "Account is deactivated" });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        
        const token = generateToken(user);
        console.log("✅ Login successful for:", email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                badge_number: user.badge_number,
                department: user.department,
                rank: user.rank
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============ PROFILE ============
app.get("/api/auth/profile", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
        const user = await User.findByPk(decoded.id, { attributes: { exclude: ["password_hash"] } });
        res.json({ success: true, user });
    } catch {
        res.status(401).json({ success: false });
    }
});

// ============ HEALTH CHECK ============
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", message: "API running with DATABASE persistence!" });
});

// ============ START SERVER ============
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ PostgreSQL CONNECTED successfully!");
        await sequelize.sync({ alter: true });
        console.log("✅ Database synchronized!");
        
        const userCount = await User.count();
        console.log(`📊 Database has ${userCount} users registered`);
        
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     🛡️  PRIME CRIME INTELLIGENCE PLATFORM                   ║
║     🗄️  DATABASE MODE - PERSISTENT STORAGE                  ║
║     📧  EMAIL OTP VERIFICATION ENABLED                       ║
║                                                              ║
║     🚀 Server running on http://localhost:${PORT}              ║
║     ✅ ${userCount} users in database                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error("❌ Database connection failed:", error.message);
        console.log("⚠️ Make sure PostgreSQL is running!");
    }
};
// Resend OTP endpoint
app.post("/api/auth/resend-otp", async (req, res) => {
  const { userId } = req.body;
  
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    
    // Save new OTP
    await OTP.create({
      user_id: user.id,
      otp_code: otpCode,
      expires_at: expiresAt,
      is_used: false
    });
    
    // Send email
    await sendOTPEmail(user.email, otpCode, user.username);
    
    console.log(`📧 New OTP sent to ${user.email}: ${otpCode}`);
    res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

startServer();
