# Stand with Nepal - Civic Engagement Platform

A comprehensive web platform that empowers Nepali citizens to report local issues, voice concerns, and engage with government representatives for better governance and infrastructure.

## 🎯 Purpose

To create a bridge between citizens and government officials, enabling:
- Citizens to freely express opinions and report local issues
- Government representatives to directly see and respond to regional concerns
- Transparent tracking of issue resolution and government responsiveness

## 🏗️ Features

### For Citizens
- **Issue Reporting**: Report problems with detailed descriptions, photos/videos, and location tagging
- **Anonymous Posting**: Option to post anonymously for sensitive issues
- **Community Engagement**: Upvote issues and add comments
- **Real-time Tracking**: Monitor the status of reported issues
- **Interactive Map**: View all issues on a map with filtering options

### For Government Officials
- **Jurisdiction-based Dashboard**: View only issues relevant to their area
- **Issue Management**: Acknowledge, update status, and resolve issues
- **Response Tracking**: Add official updates and responses
- **Analytics**: Performance metrics and resolution statistics
- **Citizen Communication**: Direct engagement with constituents

### For System Administrators
- **User Management**: Approve government official accounts
- **Content Moderation**: Review and moderate flagged content
- **System Analytics**: Comprehensive platform statistics
- **Data Management**: Oversee all platform operations

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: PHP 7.4+
- **Database**: MySQL 5.7+
- **Maps**: Leaflet.js with OpenStreetMap
- **Charts**: Chart.js for analytics
- **Icons**: Font Awesome
- **Responsive**: Mobile-first design approach

## 📁 Project Structure

```
standwithnepal/
├── index.html              # Main homepage
├── login.html              # Authentication page
├── dashboard.html          # Government official dashboard
├── config/
│   ├── database.php        # Database connection
│   └── init_db.php         # Database initialization
├── api/
│   ├── auth.php           # Authentication endpoints
│   ├── issues.php         # Issue management endpoints
│   ├── locations.php      # Location data endpoints
│   ├── analytics.php      # Analytics endpoints
│   └── upload.php         # File upload handler
├── assets/
│   ├── css/
│   │   ├── style.css      # Main stylesheet
│   │   └── dashboard.css  # Dashboard-specific styles
│   └── js/
│       ├── main.js        # Main application logic
│       ├── login.js       # Authentication logic
│       └── dashboard.js   # Dashboard functionality
├── uploads/               # File upload directory
└── public/               # Static assets
```

## 🚀 Installation & Setup

### Prerequisites
- Web server (Apache/Nginx)
- PHP 7.4 or higher
- MySQL 5.7 or higher
- Modern web browser

### Installation Steps

1. **Clone/Download the project**
   ```bash
   git clone [repository-url]
   cd standwithnepal
   ```

2. **Database Setup**
   - Create a MySQL database named `standwithnepal`
   - Update database credentials in `config/database.php`
   - Run the initialization script:
   ```bash
   php config/init_db.php
   ```

3. **Web Server Configuration**
   - Point your web server document root to the project directory
   - Ensure PHP is enabled
   - Set proper permissions for the `uploads/` directory:
   ```bash
   chmod 755 uploads/
   ```

4. **Access the Application**
   - Open your web browser and navigate to your server URL
   - The application should load with the homepage

### Default Accounts

**System Administrator:**
- Username: `admin`
- Password: `admin123`
- Admin Code: `SWN2025`

**Government Official:**
- Official ID: `KTM001`
- Password: `official123`
- Jurisdiction: Ward Level (Kathmandu Ward-10)

## 🗺️ Geographic Coverage

The platform supports Nepal's administrative structure:
- **7 Provinces** (प्रदेश)
- **77 Districts** (जिल्ला)
- **753 Local Levels** (स्थानीय तह)
  - Metropolitan Cities
  - Sub-Metropolitan Cities
  - Municipalities
  - Rural Municipalities

## 📊 Key Modules

### 1. Issue Posting System
- Comprehensive form with validation
- Category-based classification
- Geographic tagging (Province → District → Municipality → Ward)
- Media upload support
- Anonymous posting option

### 2. Authentication & Authorization
- Multi-role user system
- Secure password hashing
- Session management
- Jurisdiction-based access control

### 3. Interactive Mapping
- Leaflet.js integration
- Issue location markers
- Filtering and clustering
- Responsive map interface

### 4. Analytics Dashboard
- Real-time statistics
- Performance metrics
- Trend analysis
- Regional comparisons

### 5. Community Features
- Upvoting system
- Comment threads
- Issue tracking
- Public engagement metrics

## 🔒 Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Prevention**: Prepared statements used throughout
- **File Upload Security**: Restricted file types and sizes
- **Session Management**: Secure session handling
- **Access Control**: Role-based permissions
- **Data Privacy**: Anonymous posting options

## 📱 Responsive Design

The platform is fully responsive and works seamlessly across:
- Desktop computers
- Tablets
- Mobile phones
- Various screen sizes and orientations

## 🌐 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

We welcome contributions to improve the platform:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@standwithnepal.org
- Documentation: [Project Wiki]
- Issues: [GitHub Issues]

## 🙏 Acknowledgments

- Nepal Government for administrative data
- OpenStreetMap contributors
- Font Awesome for icons
- Chart.js and Leaflet.js communities

---

**Stand with Nepal** - Empowering citizens, strengthening democracy. 🇳🇵