export const renderTermsPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="robots" content="noindex,nofollow" />
        <title>Terms of Service - Stape MCP Server for Google Tag Manager</title>
        <style>
            html {
                display: flex;
                flex-direction: column;
                min-height: 100%;
            }
            body {
                display: flex;
                flex-direction: column;
                flex: 1 0 auto;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                color: #333;
            }
            main {
              flex: 1;
            }
            h1 {
                color: #2c3e50;
                border-bottom: 3px solid #3498db;
                padding-bottom: 10px;
            }
            h2 {
                color: #34495e;
                margin-top: 30px;
            }
            h3 {
                color: #7f8c8d;
            }
            strong {
                color: #2c3e50;
            }
            ul {
                padding-left: 20px;
            }
            li {
                margin-bottom: 8px;
            }
            .highlight {
                background-color: #f8f9fa;
                border-left: 4px solid #e74c3c;
                padding: 15px;
                margin: 20px 0;
            }
            .contact {
                background-color: #ecf0f1;
                padding: 20px;
                border-radius: 5px;
                margin-top: 30px;
            }
            hr {
                border: none;
                height: 2px;
                background-color: #bdc3c7;
                margin: 30px 0;
            }
            .section {
                margin-bottom: 25px;
            }
            footer {
                display: flex;
                justify-content: center;
                column-gap: 24px;
                margin-top: 16px;
            }
        </style>
    </head>
    <body>
      <main>
        <h1>Terms of Service - Stape MCP Server for Google Tag Manager</h1>
        
        <p><strong>Last updated:</strong> June 20, 2025</p>
        
        <p>Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Stape MCP Server for Google Tag Manager (the "Service") operated by STAPE, INC. ("Company", "us", "we", or "our").</p>
        
        <p>When we refer to "you" or "your", we mean any person that accesses or uses the Service. Your use of the Service is subject to these Terms and our <a href="/privacy">Privacy Notice</a>.</p>
        
        <p><strong>YOUR ACCESS TO AND USE OF THE SERVICE IS CONDITIONED ON YOUR ACCEPTANCE OF AND COMPLIANCE WITH THESE TERMS. BY ACCESSING OR USING THE SERVICE YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DISAGREE WITH ANY PART OF THE TERMS THEN YOU MAY NOT ACCESS THE SERVICE.</strong></p>
    
        <div class="section">
            <h2>1. General Terms</h2>
            <ul>
                <li>These Terms constitute a legally binding agreement between you and the Company</li>
                <li>By using this Service, you confirm that you meet the following requirements:
                    <ul>
                        <li>You have the legal capacity necessary to enter into these Terms</li>
                        <li>There are no restrictions for you in terms of being a consumer or a business user</li>
                        <li>You aren't located in a country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a "terrorist-supporting" country</li>
                        <li>You aren't listed on any U.S. Government list of prohibited or restricted parties</li>
                    </ul>
                </li>
            </ul>
        </div>
    
        <div class="section">
            <h2>2. Service Functionality</h2>
            <p>The Service provides middleware proxy capabilities for Google Tag Manager API access, including:</p>
            <ul>
                <li>Enabling MCP (Model Context Protocol) clients to connect with Google Tag Manager APIs</li>
                <li>Providing OAuth 2.0 authentication for secure API access</li>
                <li>Acting as a pass-through proxy without storing or processing user data</li>
                <li>Supporting all Google Tag Manager API endpoints for comprehensive GTM management</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>3. User Conduct</h2>
            <p>When using the Service you agree to not:</p>
            <ul>
                <li>Violate or help another person violate these Terms or applicable law</li>
                <li>Violate intellectual property rights of any party</li>
                <li>Use the Service in any way that can damage, disable or overburden the Service, which may include uploading viruses, Trojan horses, spyware, adware, or any other malicious code</li>
                <li>Perform DoS attacks, interfere with or disrupt any network, equipment, or server connected to the Service</li>
                <li>Attempt to gain unauthorized access to the Service, computer systems or networks connected to the Service, or extract data not intended for you</li>
                <li>Use the Service for any illegal or unauthorized purposes</li>
                <li>Violate the legislation which may apply to you when using the Service</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>5. Authentication and Access</h2>
            <ul>
                <li>You must provide valid Google OAuth 2.0 credentials</li>
                <li>You are responsible for maintaining the confidentiality of your access tokens</li>
                <li>You may revoke access at any time through your Google Account settings</li>
                <li>We store only OAuth tokens necessary for service functionality</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>6. Data Handling and Privacy</h2>
            <ul>
                <li>We act solely as a middleware proxy service</li>
                <li>No user data or Tag Manager content is stored or retained</li>
                <li>All data passes through our service without processing or analysis</li>
                <li>See our Privacy Policy for detailed information</li>
            </ul>
        </div>
    
        <div class="highlight">
            <h2>Compliance with Google Policies and Limited Use Requirements</h2>
            <p>The Service complies with:</p>
            <ul>
                <li>Google Workspace API User Data Policy</li>
                <li>Google Tag Manager API Terms of Service</li>
                <li>Limited Use requirements for API data</li>
            </ul>
            
            <p><strong>Affirmative Compliance Statement:</strong><br>
            <em>"The use of raw or derived user data received from Workspace APIs will adhere to the Google User Data Policy, including the Limited Use requirements."</em></p>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="color: #856404; margin: 0;"><strong>AI/ML Prohibition:</strong> We do not use any Google API data for AI/ML model training or improvement at all. This service operates as a middleware proxy without any artificial intelligence or machine learning functionality.</p>
            </div>
        </div>
    
        <div class="section">
            <h2>4. Liability</h2>
            <p>Violation of these Terms will result in liability under the applicable law, unless otherwise provided in the Terms.</p>
            
            <p>To the extent permitted by the applicable law, the Company and its affiliates shall not be liable for:</p>
            <ul>
                <li>The accuracy, completeness of the Service and its Content</li>
                <li>The accuracy, completeness, or content of any websites linked to the Service (through hyperlinks, banner advertising, or otherwise)</li>
                <li>Property damage of any nature, connected with the use of the Service</li>
                <li>Third-party conduct</li>
                <li>Any unauthorized access to or use of the Company's servers and/or any Content, personal information or other information and data stored if such unauthorized access did not directly occur due to the Company's actions or inactions</li>
                <li>Any interruption or cessation of access to the Service</li>
                <li>Any viruses, worms, bugs, Trojan horses, or the like, which may be transmitted to or from the Service or any third-party websites</li>
                <li>Any loss or damage of any kind incurred as a result of your use of the Service, whether or not the Company advised of the possibility of such damages</li>
                <li>Other risks associated with the use of online platforms and services</li>
            </ul>
            
            <p>The Service is provided on the "as-is" basis without any warranty or guarantee whatsoever.</p>
            
            <p>To the extent permitted by the applicable law, you agree to defend, indemnify, and hold harmless the Company from and against all claims, damages, obligations, losses, liabilities, costs or debts, and expenses (including, but not limited to, attorney fees) arising from:</p>
            <ul>
                <li>Your use of the Service</li>
                <li>Your violation of these Terms and the applicable law</li>
            </ul>
            
            <p>In case of any circumstances of insuperable force (i.e. events of extraordinary or insuperable nature) that have occurred and remain in effect beyond the party's control and that a party could neither foresee nor prevent for objective reasons, if these circumstances prevent a party from proper fulfilment of its obligations hereunder, the term for the fulfilment of such obligations shall be extended for the period of the effect of such circumstances of insuperable force.</p>
            
            <p>The circumstances of insuperable force shall include wars and other military operations, earthquakes, floods, and other natural disasters, adoption of laws and regulations by state and local authorities, epidemics and pandemics, failure of power supply or communication system, or other similar circumstances that prevent the parties from the proper fulfilment of their obligations under these Terms.</p>
        </div>
    
        <div class="section">
            <h2>5. Content, Intellectual Property, and Links</h2>
            <ul>
                <li>We use the Service to provide middleware proxy functionality between MCP clients and Google Tag Manager APIs</li>
                <li>All Service components and Content (unless stated otherwise) and the Service as a whole, Company's Content belong to the Company and are protected by intellectual property legislation</li>
                <li>You cannot use our intellectual property without our direct written consent, unless such use is permitted by law</li>
                <li>Our Service may interact with third-party services that are not owned or controlled by us. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party services</li>
                <li>You further acknowledge and agree that we shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such third-party services</li>
                <li>We strongly advise you to read the terms and conditions and privacy policies of any third-party services that you use</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>10. Prohibited Uses</h2>
            <p>You may not:</p>
            <ul>
                <li>Use the Service to violate any laws or regulations</li>
                <li>Attempt to gain unauthorized access to other users' data</li>
                <li>Overload or interfere with the Service's operation</li>
                <li>Use the Service for any commercial purposes without permission</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>11. Service Modifications</h2>
            <p>We reserve the right to:</p>
            <ul>
                <li>Modify or update the Service at any time</li>
                <li>Change these Terms of Service with notice</li>
                <li>Suspend or terminate accounts for violations</li>
                <li>Discontinue the Service with reasonable notice</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>12. Termination</h2>
            <ul>
                <li>You may stop using the Service at any time</li>
                <li>We may terminate your access for violations of these terms</li>
                <li>Upon termination, stored OAuth tokens will be deleted</li>
                <li>These terms survive termination where applicable</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>13. Third-Party Services</h2>
            <ul>
                <li>The Service relies on Google APIs and cloud infrastructure providers</li>
                <li>We are not responsible for third-party service availability or performance</li>
                <li>Third-party terms and policies may also apply</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>14. Support and Contact</h2>
            <ul>
                <li>The Service is provided on a best-effort basis</li>
                <p>Please use the following email address for dispute resolution purposes: <strong>support@stape.io</strong></p>
                <li>We do not guarantee response times or issue resolution</li>
            </ul>
        </div>
    
        <div class="section">
            <h2>6. Governing Law and Dispute Resolution</h2>
            <ul>
                <li>These Terms shall be governed and construed in accordance with the laws of the State of Delaware</li>
                <li>You and the Company shall attempt to resolve any disputes by negotiations</li>
                <li>Please use the following email address for dispute resolution purposes: <strong>support@stape.io</strong></li>
                <li>In case we cannot resolve the dispute in 30 days from the day we start negotiations, it shall be resolved by the courts of the State of Delaware</li>
                <li>You also agree that regardless of any statute or law to the contrary, any claim or cause of action of yours arising from or related to the use of the Service must be filed within 3 months after such claim or cause of action arose or be forever barred</li>
            </ul>
            <p>Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect. These Terms constitute the entire agreement between us regarding our Service and supersede and replace any prior agreements we might have between us regarding the Service.</p>
        </div>
    
        <hr>
        
        <div class="contact">
            <p><strong>STAPE, INC.</strong><br>
            Registered address: 8 The Green Suite 12892, Dover, DE, USA, 19901<br>
            Contact email address: <strong>support@stape.io</strong></p>
            <p><strong>Last Updated:</strong> June 20, 2025</p>
        </div>
      </main>
      
       <footer>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </footer>
    </body>
    </html>
  `;
};
