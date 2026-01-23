
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Datos de prueba
const testTicket = {
  idDep: 1,
  nombreContacto: "María García",
  correoContacto: "maria.garcia@ejemplo.com",
  descripcionProblema: "No puedo acceder a la aplicación web. Recibo error 403 al intentar login."
};

async function testCrearTicket() {
  try {
    console.log(' Creando ticket de prueba...\n');
    console.log('Datos enviados:', testTicket);
    console.log('\n Esperando respuesta...\n');

    const response = await axios.post(`${BASE_URL}/api/tickets`, testTicket);

    console.log(' ÉXITO - Ticket creado exitosamente\n');
    console.log('Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n Se enviaron automáticamente:');
    console.log(`  1. Correo a usuario: ${testTicket.correoContacto}`);
    console.log(`  2. Correo a soporte: soporte@empresa.com`);

    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('❌ ERROR - El servidor retornó un error:\n');
      console.log('Status:', error.response.status);
      console.log('Datos:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('❌ ERROR - No hay respuesta del servidor');
      console.log('¿Está el servidor ejecutándose en http://localhost:3000?');
    } else {
      console.log('❌ ERROR:', error.message);
    }
  }
}

async function testObtenerTickets() {
  try {
    console.log('\n Obteniendo todos los tickets...\n');

    const response = await axios.get(`${BASE_URL}/api/tickets`);

    console.log(' ÉXITO - Tickets obtenidos\n');
    console.log(`Total de tickets: ${response.data.total}\n`);
    
    if (response.data.tickets.length > 0) {
      console.log('Últimos 3 tickets:');
      response.data.tickets.slice(0, 3).forEach(ticket => {
        console.log(`\n  Ticket #${ticket.IdTicket}`);
        console.log(`  - Departamento: ${ticket.NomDep}`);
        console.log(`  - Contacto: ${ticket.NombreContacto}`);
        console.log(`  - Estado: ${ticket.Estado}`);
        console.log(`  - Fecha: ${ticket.FechaCreacion}`);
      });
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('❌ ERROR:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ ERROR:', error.message);
    }
  }
}

async function testObtenerDepartamentos() {
  try {
    console.log('\n Obteniendo departamentos...\n');

    const response = await axios.get(`${BASE_URL}/api/departamentos`);

    console.log(' ÉXITO - Departamentos obtenidos\n');
    console.log(`Total de departamentos: ${response.data.total}\n`);
    
    response.data.departamentos.forEach(dept => {
      console.log(`  ${dept.IdDep}. ${dept.NomDep}`);
    });

    return response.data;
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

// Ejecutar pruebas
async function ejecutarPruebas() {
  console.log('='.repeat(60));
  console.log(' PRUEBAS DEL SISTEMA DE TICKETS');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Obtener departamentos
  await testObtenerDepartamentos();

  // Test 2: Crear ticket
  await testCrearTicket();

  // Test 3: Obtener tickets
  await testObtenerTickets();

  console.log('\n' + '='.repeat(60));
  console.log(' Pruebas completadas');
  console.log('='.repeat(60));
}

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarPruebas().catch(console.error);
}

module.exports = { testCrearTicket, testObtenerTickets, testObtenerDepartamentos };
