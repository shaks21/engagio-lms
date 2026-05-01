import { test, expect } from '@playwright/test';
import axios from 'axios';

const API = 'http://164.68.119.230:3000/api';

test.describe('Logout API', () => {
  test('should return 401 for missing auth header', async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      throw new Error('Should have thrown 401');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.message).toBe('No token provided');
    }
  });

  test('should return 401 for malformed auth header', async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, {
        headers: { Authorization: 'InvalidHeader' }
      });
      throw new Error('Should have thrown 401');
    } catch (error: any) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.message).toBe('Malformed authorization header');
    }
  });
});
