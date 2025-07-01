addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

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
      return new Response('Missing required fields', { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

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
      `${data.company} - ${data.name}` : 
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
        status: { name: 'New Lead' }
      },
      'Source': {
        select: { name: 'Website Contact Form' }
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
      console.error('Failed to create main record:', createResponse.status, await createResponse.text());
      throw new Error(`Failed to create main record: ${createResponse.status}`);
    }
    
    console.log('Successfully created CRM record');

    // STEP 5: Send backup email using MailChannels
    console.log('Sending backup email...');
    try {
      const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: NOTIFICATION_EMAIL, name: 'Jon DeLeon' }]
          }],
          from: {
            email: 'noreply@jondeleonmedia.com',
            name: 'Jon DeLeon Media Website'
          },
          subject: 'New Website Contact Form Submission',
          content: [{
            type: 'text/plain',
            value: `New contact form submission received:

Name: ${data.name}
Email: ${data.email}
Company: ${data.company}
Service Package: ${data.service}
Message: ${data.message}

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}

This submission has been automatically saved to your Notion CRM with proper relations.

---
Sent automatically from jondeleonmedia.com contact form`
          }]
        })
      });

      if (emailResponse.ok) {
        console.log('Backup email sent successfully');
      } else {
        console.error('Failed to send backup email:', emailResponse.status, await emailResponse.text());
        // Don't fail the whole request if email fails
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Don't fail the whole request if email fails
    }

    console.log('Form submission successful');
    
    // Return success response
    return new Response('Success', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    })

  } catch (error) {
    console.error('Error processing form:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}