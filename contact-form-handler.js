addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

function isSpamSubmission(data) {
  const spamIndicators = [
    // Random Gmail patterns (long random strings)
    /^[a-z0-9]{10,}@gmail\.com$/i,
    // Common spam domains
    /@(tempmail|guerrillamail|10minutemail|mailinator|yopmail|throwaway)/i,
    // Obvious spam usernames
    /^(test|spam|admin|info|contact|support|sales|marketing)\d*@/i,
    // All numbers username
    /^\d+@/i
  ];
  
  // Check email patterns
  for (const pattern of spamIndicators) {
    if (pattern.test(data.email)) {
      console.log('Spam detected: suspicious email pattern');
      return true;
    }
  }
  
  // Check for empty or very short messages
  if (!data.message || data.message.length < 10) {
    console.log('Spam detected: message too short');
    return true;
  }
  
  // Check for spam keywords in message
  const spamKeywords = [
    'crypto', 'bitcoin', 'investment', 'loan', 'seo services', 'web design', 
    'marketing services', 'increase sales', 'boost ranking', 'free trial',
    'limited time', 'act now', 'congratulations', 'winner', 'claim now'
  ];
  const messageText = data.message.toLowerCase();
  
  const hasSpamKeywords = spamKeywords.some(keyword => messageText.includes(keyword));
  if (hasSpamKeywords) {
    console.log('Spam detected: spam keywords found');
    return true;
  }
  
  // Check for suspicious name patterns
  if (data.name && (/^[a-z]+\d+$/i.test(data.name) || data.name.length < 2)) {
    console.log('Spam detected: suspicious name pattern');
    return true;
  }
  
  return false;
}

async function sendEmail(data, isError = false, errorDetails = null) {
  try {
    const subject = isError ? 
      'ERROR: Contact Form Submission Failed - Jon DeLeon Media' : 
      'New Client Inquiry - Jon DeLeon Media';
    
    const emailBody = isError ? 
      `Hi Jon,

There was an error processing a contact form submission:

ERROR DETAILS:
${errorDetails}

FORM DATA THAT FAILED:
Name: ${data.name}
Email: ${data.email}
Company: ${data.company}
Service Interest: ${data.service}
Message: "${data.message}"

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}

Please follow up manually with this person.

Your Website` :
      `Hi Jon,

You have a new client inquiry through your website:

Name: ${data.name}
Email: ${data.email}
Company: ${data.company}
Service Interest: ${data.service}

Their message:
"${data.message}"

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}

This inquiry has been saved to your Notion CRM for follow-up.

Cheers,
Your Website`;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'notifications@mail.jondeleonmedia.com',
        to: [NOTIFICATION_EMAIL],
        subject: subject,
        text: emailBody
      })
    });

    if (emailResponse.ok) {
      console.log('Email sent successfully');
      return true;
    } else {
      console.error('Failed to send email:', emailResponse.status, await emailResponse.text());
      return false;
    }
  } catch (emailError) {
    console.error('Email sending error:', emailError);
    return false;
  }
}

async function handleRequest(request) {
  console.log('Worker started, method:', request.method);
  console.log('Request URL:', request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  if (request.method !== 'POST') {
    console.log('Method not allowed:', request.method);
    return new Response('Method not allowed', { 
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  try {
    console.log('Processing form submission...');
    const formData = await request.formData()
    console.log('Form data received');
    
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      company: formData.get('company') || 'Not specified',
      service: formData.get('service'),
      message: formData.get('message')
    }
    
    console.log('Parsed data:', JSON.stringify(data, null, 2));

    // Validate required fields
    if (!data.name || !data.email || !data.service || !data.message) {
      console.log('Missing required fields');
      await sendEmail(data, true, 'Missing required fields');
      return new Response('Missing required fields', { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Check for spam
    if (isSpamSubmission(data)) {
      console.log('Spam submission detected, blocking silently');
      // Return success to fool bots, but don't process or send emails
      return new Response('Success', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        }
      })
    }

    let notionSuccess = false;
    let notionError = null;

    try {
      // Clean service name (remove pricing info)
      const cleanServiceName = data.service.replace(/ \([^)]*\)$/, '').trim();
      console.log('Clean service name:', cleanServiceName);

      // STEP 1: Create or find person in People DB
      console.log('Creating/finding person in People DB...');
      
      // Check if person exists by email
      const peopleSearch = await fetch(`https://api.notion.com/v1/databases/${PEOPLE_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: 'Email',
            email: {
              equals: data.email
            }
          }
        })
      })

      if (!peopleSearch.ok) {
        console.error('People search failed:', peopleSearch.status, await peopleSearch.text());
        throw new Error(`People search failed: ${peopleSearch.status}`);
      }

      const existingPeople = await peopleSearch.json()
      let personId;

      if (existingPeople.results && existingPeople.results.length > 0) {
        personId = existingPeople.results[0].id;
        console.log('Found existing person:', personId);
      } else {
        // Create new person
        console.log('Creating new person...');
        const newPerson = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parent: { database_id: PEOPLE_DB_ID },
            properties: {
              'Name': {
                title: [{ text: { content: data.name } }]
              },
              'Email': {
                email: data.email
              }
            }
          })
        })

        if (!newPerson.ok) {
          console.error('Failed to create person:', newPerson.status, await newPerson.text());
          throw new Error(`Failed to create person: ${newPerson.status}`);
        }

        const personData = await newPerson.json();
        personId = personData.id;
        console.log('Created new person:', personId);
      }

      // STEP 2: Create or find organization
      let organizationId = null;
      if (data.company && data.company !== 'Not specified') {
        console.log('Creating/finding organization...');
        
        // Check if organization exists
        const orgSearch = await fetch(`https://api.notion.com/v1/databases/${ORGANIZATIONS_DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              property: 'Name',
              title: {
                equals: data.company
              }
            }
          })
        })

        if (orgSearch.ok) {
          const existingOrgs = await orgSearch.json();
          
          if (existingOrgs.results && existingOrgs.results.length > 0) {
            organizationId = existingOrgs.results[0].id;
            console.log('Found existing organization:', organizationId);
          } else {
            // Create new organization
            console.log('Creating new organization...');
            const newOrg = await fetch('https://api.notion.com/v1/pages', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                parent: { database_id: ORGANIZATIONS_DB_ID },
                properties: {
                  'Name': {
                    title: [{ text: { content: data.company } }]
                  }
                }
              })
            })

            if (newOrg.ok) {
              const orgData = await newOrg.json();
              organizationId = orgData.id;
              console.log('Created new organization:', organizationId);
            } else {
              console.error('Failed to create organization:', newOrg.status, await newOrg.text());
            }
          }
        } else {
          console.error('Organization search failed:', orgSearch.status, await orgSearch.text());
        }
      }

      // STEP 3: Find service in Services DB
      let serviceId = null;
      console.log('Finding service in Services DB...');
      
      const serviceSearch = await fetch(`https://api.notion.com/v1/databases/${SERVICES_DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: 'Name',
            title: {
              equals: cleanServiceName
            }
          }
        })
      })

      if (serviceSearch.ok) {
        const existingServices = await serviceSearch.json();
        
        if (existingServices.results && existingServices.results.length > 0) {
          serviceId = existingServices.results[0].id;
          console.log('Found existing service:', serviceId);
        } else {
          console.log('Service not found in database, will store as text');
        }
      } else {
        console.error('Service search failed:', serviceSearch.status, await serviceSearch.text());
      }

      // STEP 4: Create main CRM record with relations
      console.log('Creating main CRM record...');
      
      // Build the title
      const recordTitle = organizationId ? 
        `${data.company} | ${data.name}` : 
        data.name;

      // Build properties object
      const properties = {
        'Name': {
          title: [{ text: { content: recordTitle } }]
        },
        'Contact | Person': {
          relation: [{ id: personId }]
        },
        'Notes': {
          rich_text: [{
            text: { 
              content: `[${new Date().toLocaleDateString()}] Website Contact: ${data.message}`
            }
          }]
        },
        'Status': {
          select: { name: 'New Lead' }
        },
        'Source': {
          select: { name: 'Website Contact Form' }
        },
        'Needs Follow Up': {
          checkbox: true
        },
        'Priority': {
          select: { 
            name: data.service.includes('producer') || data.service.includes('custom') ? 'High' : 
                  data.service.includes('studio') ? 'Medium' : 'Low'
          }
        },
        'Follow Up Due': {
          date: { 
            start: new Date(Date.now() + (4 * 60 * 60 * 1000)).toISOString() // 4 hours from now with time
          }
        }
      };

      // Add organization relation if we have one
      if (organizationId) {
        properties['Organization'] = {
          relation: [{ id: organizationId }]
        };
      }

      // Add service relation if found, otherwise store as text
      if (serviceId) {
        properties['Services'] = {
          relation: [{ id: serviceId }]
        };
      } else {
        properties['Service Interest'] = {
          rich_text: [{ text: { content: data.service } }]
        };
      }

      const createResponse = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: { database_id: CLIENTS_DB_ID },
          properties: properties
        })
      })
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create main record:', createResponse.status, errorText);
        throw new Error(`Failed to create main record: ${createResponse.status} ${errorText}`);
      }
      
      console.log('Successfully created CRM record');
      notionSuccess = true;
      
    } catch (notionErr) {
      console.error('Notion integration failed:', notionErr);
      notionError = notionErr.message;
      notionSuccess = false;
    }

    // ALWAYS send email (success or fallback)
    if (notionSuccess) {
      // Send success email
      await sendEmail(data, false);
    } else {
      // Send error email with form data
      await sendEmail(data, true, `Notion integration failed: ${notionError}`);
    }

    console.log('Form submission completed');
    
    // Return success response regardless of Notion status
    return new Response('Success', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    }) 

  } catch (error) {
    console.error('Critical error processing form:', error);
    
    // Try to send error email even if everything fails
    try {
      const basicData = {
        name: 'Unknown',
        email: 'Unknown', 
        company: 'Unknown',
        service: 'Unknown',
        message: 'Form data could not be parsed'
      };
      await sendEmail(basicData, true, `Critical worker error: ${error.message}`);
    } catch (emailErr) {
      console.error('Even error email failed:', emailErr);
    }
    
    return new Response('Internal server error', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}