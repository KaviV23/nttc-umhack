import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Button,
  Group,
  Anchor,
  Stack,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {

  const navigate = useNavigate();

  const form = useForm({
    initialValues: {
      merchantId: '',
      password: '',
    },

    validate: {
      merchantId: (value) => (/^[a-zA-Z0-9]{5}$/.test(value) ? null : 'Invalid Merchant ID'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    console.log('Logging in with:', values);

    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ merchant_id: values.merchantId, password: "ThisIsADummyPassWord" }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.access_token) {
          localStorage.setItem('access_token', result.access_token)
          navigate("/")
        } else {{
          // TODO: Handle Error
        }}
      })
    ;
  };

  return (
    <Stack h="100vh" justify="space-around">
      <Box w={420} mx="auto">
        <Title mb="lg" style={{ textAlign: "center" }}>
          GrabEx Login
        </Title>

        <Paper withBorder shadow="md" p={30} radius="md">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Merchant ID"
                placeholder="c5e2a"
                {...form.getInputProps("merchantId")}
              />

              <PasswordInput
                label="Password"
                placeholder="Password"
                {...form.getInputProps("password")}
              />
            </Stack>

            <Group mt="lg">
              <Anchor component="button" type="button" size="sm">
                Forgot password?
              </Anchor>
            </Group>

            <Button fullWidth mt="xl" type="submit">
              Login
            </Button>
          </form>
        </Paper>
      </Box>
    </Stack>
  );
};

export default LoginPage;
