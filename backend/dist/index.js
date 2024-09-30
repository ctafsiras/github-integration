"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const express_session_1 = __importDefault(require("express-session"));
const cors_1 = __importDefault(require("cors"));
const client_dynamodb_2 = require("@aws-sdk/client-dynamodb");
(0, dotenv_1.config)(); // Load environment variables
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// DynamoDB setup
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
// Middleware
app.use((0, cors_1.default)({ origin: "http://localhost:5173", credentials: true }));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Passport configuration
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3001/auth/github/callback",
}, (accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    const user = {
        id: profile.id,
        username: profile.username,
        accessToken,
        refreshToken,
    };
    // Save user to DynamoDB
    const command = new lib_dynamodb_1.PutCommand({
        TableName: "Users",
        Item: user,
    });
    try {
        yield docClient.send(command);
        return done(null, user);
    }
    catch (error) {
        return done(error);
    }
})));
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    const command = new lib_dynamodb_1.GetCommand({
        TableName: "Users",
        Key: { id },
    });
    try {
        const { Item } = yield docClient.send(command);
        done(null, Item);
    }
    catch (error) {
        done(error);
    }
}));
function createUsersTableIfNotExists() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if table already exists
            yield dynamoClient.send(new client_dynamodb_2.DescribeTableCommand({ TableName: "Users" }));
            console.log("Users table already exists");
        }
        catch (error) {
            if (error.name === "ResourceNotFoundException") {
                // Table doesn't exist, so create it
                const params = {
                    TableName: "Users",
                    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
                    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
                    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
                };
                try {
                    yield dynamoClient.send(new client_dynamodb_2.CreateTableCommand({
                        TableName: "Users",
                        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
                        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
                        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
                    }));
                    console.log("Users table created successfully");
                }
                catch (createError) {
                    console.error("Error creating Users table:", createError);
                    throw createError;
                }
            }
            else {
                console.error("Error checking Users table:", error);
                throw error;
            }
        }
    });
}
// Routes
app.get("/auth/github", passport_1.default.authenticate("github", { scope: ["repo"] }));
app.get("/auth/github/callback", passport_1.default.authenticate("github", { failureRedirect: "/login" }), (req, res) => {
    res.redirect("http://localhost:5173/dashboard");
});
app.get("/api/user", (req, res) => {
    res.json(req.user || null);
});
app.post("/api/feedback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, body } = req.body;
    const user = req.user;
    if (!user || !user.accessToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    console.log(`Creating demo issue: ${title}`);
    res.json({ message: "Feedback submitted successfully" });
}));
createUsersTableIfNotExists().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error("Failed to start server:", error);
});
