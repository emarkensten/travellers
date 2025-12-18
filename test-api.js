const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testAPI() {
  console.log('Testing the API endpoint with GPT-5.2...\n');

  // Create a test file
  const testContent = `Traveller Information:
1. John Smith, born 1990-05-15, Male, Swedish
2. Jane Doe, born 1985-03-22, Female, Norwegian
`;

  fs.writeFileSync('/tmp/test-travellers.txt', testContent);

  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream('/tmp/test-travellers.txt'));

    // Send request
    console.log('Sending request to API...');
    const response = await axios.post('http://localhost:3000/api/process-travellers', form, {
      headers: form.getHeaders(),
    });

    console.log('✓ API Response received successfully!\n');
    console.log('Extracted data:');
    console.log(JSON.stringify(response.data, null, 2));

    // Clean up
    fs.unlinkSync('/tmp/test-travellers.txt');

    console.log('\n✓ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error testing API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }

    // Clean up
    if (fs.existsSync('/tmp/test-travellers.txt')) {
      fs.unlinkSync('/tmp/test-travellers.txt');
    }

    process.exit(1);
  }
}

testAPI();
