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

    // STEP 2: Create main CRM record with person relation
    console.log('Creating main CRM record...');
    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: CLIENTS_DB_ID },
        properties: {
          'Contact | Person': {
            relation: [{ id: personId }]
          },
          'Company Name': {
            rich_text: [{ text: { content: data.company } }]
          },
          'Service Interest': {
            rich_text: [{ text: { content: data.service } }]
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
        }
      })
    })
    
    if (!createResponse.ok) {
      console.error('Failed to create main record:', createResponse.status, await createResponse.text());
      throw new Error(`Failed to create main record: ${createResponse.status}`);
    }
    
    console.log('Successfully created CRM record');

    // STEP 3: Send backup email notification
    console.log('Sending backup email...');
    try {
      const emailResponse = await fetch('https://api.cloudflare.com/client/v4/accounts/' + CLOUDFLARE_ACCOUNT_ID + '/email/routing/addresses/' + encodeURIComponent('noreply@jondeleonmedia.com') + '/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: NOTIFICATION_EMAIL, name: 'Jon DeLeon' }]
          from: { email: 'noreply@jondeleonmedia.com', name: 'Jon DeLeon Media Website' },
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
Person ID in Notion: ${personId}

This submission has been automatically saved to your Notion CRM.`
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